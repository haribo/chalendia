//! Refusing input the same way everywhere.
//!
//! Every screen that refuses something collects **all** of its problems in one
//! pass: correcting one field at a time is what makes an operator submit five
//! times (`docs/design/core.md` § 8, Errors).

/// A refused field, and the words that go with it — or none, when the value
/// already shows the problem.
#[derive(Debug, PartialEq, Eq)]
pub struct FieldProblem {
    pub field: &'static str,
    pub reason: Option<String>,
}

impl FieldProblem {
    /// A blank required field needs no words: whoever left it empty can see it.
    pub fn blank(field: &'static str) -> Self {
        Self {
            field,
            reason: None,
        }
    }

    pub fn saying(field: &'static str, reason: impl Into<String>) -> Self {
        Self {
            field,
            reason: Some(reason.into()),
        }
    }
}

/// Trims a required value, recording a problem when nothing is left.
pub fn required(value: &str, field: &'static str, problems: &mut Vec<FieldProblem>) -> String {
    let value = value.trim();
    if value.is_empty() {
        problems.push(FieldProblem::blank(field));
    }
    value.to_owned()
}

/// Trims an optional value, keeping nothing rather than an empty string: a
/// description someone cleared is absent, not present and blank.
pub fn optional(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_blank_required_value_is_refused_without_words() {
        let mut problems = Vec::new();
        required("   ", "title", &mut problems);

        assert_eq!(problems, vec![FieldProblem::blank("title")]);
    }

    #[test]
    fn a_required_value_comes_back_trimmed() {
        let mut problems = Vec::new();
        let value = required("  Savon de Marseille  ", "title", &mut problems);

        assert_eq!(value, "Savon de Marseille");
        assert!(problems.is_empty());
    }

    #[test]
    fn an_optional_value_left_blank_is_absent() {
        assert_eq!(optional(Some("   ")), None);
        assert_eq!(optional(None), None);
        assert_eq!(optional(Some(" olive ")), Some("olive".to_owned()));
    }
}
