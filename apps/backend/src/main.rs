use std::process::ExitCode;

use chalendia_backend::config::Config;
use chalendia_backend::db;
use chalendia_backend::http::{AppState, router};
use chalendia_backend::images::Deriver;
use chalendia_backend::storage::Storage;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> ExitCode {
    // Searches the current directory and its parents, so the repository-root
    // `.env` is found whichever app directory the binary is started from.
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = match Config::from_env() {
        Ok(config) => config,
        Err(error) => {
            // Configuration errors are reported before anything is served, and
            // name the variable at fault: the operator is the one who fixes it.
            tracing::error!("configuration error: {error}");
            eprintln!("configuration error: {error}");
            return ExitCode::FAILURE;
        }
    };

    let pool = match db::pool(&config) {
        Ok(pool) => pool,
        Err(error) => {
            tracing::error!("cannot use the configured database url: {error}");
            eprintln!("cannot use the configured database url: {error}");
            return ExitCode::FAILURE;
        }
    };

    // Before the listener exists: an instance that cannot bring its schema to
    // the expected state must not serve a single request.
    if let Err(error) = db::migrate(&pool).await {
        tracing::error!("migration failed: {error}");
        eprintln!("migration failed: {error}");
        return ExitCode::FAILURE;
    }

    let storage = Storage::at(&config.media_dir);
    if let Err(error) = tokio::fs::create_dir_all(storage.root()).await {
        // Before the listener: a shop that cannot write an image would accept
        // uploads all day and lose every one of them.
        tracing::error!(
            "cannot use the media directory {}: {error}",
            storage.root().display()
        );
        eprintln!(
            "cannot use the media directory {}: {error}",
            storage.root().display()
        );
        return ExitCode::FAILURE;
    }

    // Looks for pending images straight away, which is how a restart in the
    // middle of an encoding is taken up again
    // (`docs/backend/adr/0008-image-pipeline.md`).
    let deriver = Deriver::default();
    tokio::spawn(deriver.clone().run(pool.clone(), storage.clone()));

    let listener = match tokio::net::TcpListener::bind(config.bind).await {
        Ok(listener) => listener,
        Err(error) => {
            tracing::error!("cannot listen on {}: {error}", config.bind);
            eprintln!("cannot listen on {}: {error}", config.bind);
            return ExitCode::FAILURE;
        }
    };

    tracing::info!(
        "listening on http://{}, public url {}, media in {}",
        config.bind,
        config.public_url,
        config.media_dir,
    );

    let state = AppState {
        db: pool,
        config: config.clone(),
        storage,
        deriver,
    };
    let served = axum::serve(listener, router(&config, state))
        .with_graceful_shutdown(shutdown_signal())
        .await;

    match served {
        Ok(()) => {
            tracing::info!("stopped");
            ExitCode::SUCCESS
        }
        Err(error) => {
            tracing::error!("server error: {error}");
            ExitCode::FAILURE
        }
    }
}

/// Stops accepting on interrupt or terminate, and lets in-flight requests end.
async fn shutdown_signal() {
    let interrupt = async {
        if tokio::signal::ctrl_c().await.is_err() {
            // Without a signal handler the future must never resolve, or the
            // server would shut down the moment it starts.
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = interrupt => tracing::info!("interrupt received, draining"),
        () = terminate => tracing::info!("terminate received, draining"),
    }
}
