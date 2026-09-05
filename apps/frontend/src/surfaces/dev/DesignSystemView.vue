<script setup lang="ts">
import { ref } from 'vue'

import AppBar from '@/shared/ui/AppBar.vue'
import Button from '@/shared/ui/Button.vue'
import CheckboxField from '@/shared/ui/CheckboxField.vue'
import Drawer from '@/shared/ui/Drawer.vue'
import FieldFrame from '@/shared/ui/FieldFrame.vue'
import Grid from '@/shared/ui/Grid.vue'
import IconCatalogue from '@/shared/ui/icons/IconCatalogue.vue'
import IconLock from '@/shared/ui/icons/IconLock.vue'
import IconMail from '@/shared/ui/icons/IconMail.vue'
import IconMenu from '@/shared/ui/icons/IconMenu.vue'
import IconReceipt from '@/shared/ui/icons/IconReceipt.vue'
import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import NavLink from '@/shared/ui/NavLink.vue'
import Page from '@/shared/ui/Page.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import PasswordField from '@/shared/ui/PasswordField.vue'
import SelectField from '@/shared/ui/SelectField.vue'
import IconTrash from '@/shared/ui/icons/IconTrash.vue'
import Stack from '@/shared/ui/Stack.vue'
import Table from '@/shared/ui/Table.vue'
import TextField from '@/shared/ui/TextField.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import GalleryMenu from '@/surfaces/dev/GalleryMenu.vue'
import GallerySection from '@/surfaces/dev/GallerySection.vue'
import GalleryCanvas from '@/surfaces/dev/GalleryCanvas.vue'
import GalleryVariant from '@/surfaces/dev/GalleryVariant.vue'

/**
 * Every shared component, with its states side by side.
 *
 * Development only — the route that reaches this file is compiled out of the
 * production build, so a merchant's installation never carries it.
 *
 * Content is realistic and includes the awkward cases the design rules name:
 * a product title that does not fit, a refused field, a crowded list. A kit
 * built from "Lorem" shows a component nobody has stressed.
 */

// Live enough to be judged: a disabled state that cannot be clicked into is a
// state nobody checks.
const title = ref('Savon au miel de châtaignier')
const overflowing = ref(
  'Savon surgras à l’argile rose et à l’huile d’amande douce, coffret de trois',
)
const email = ref('marchand@fabrique-savons.example')
const secret = ref('')
const weak = ref('motdepasse123')
const rate = ref('standard')
const publish = ref(false)
const drawerOpen = ref(false)

const rates = [
  { value: 'standard', label: 'Standard — 20 %' },
  { value: 'reduced', label: 'Réduit — 5,5 %' },
  { value: 'zero', label: 'Exonéré — 0 %' },
]

// A catalogue, as a surface would hand one over: five of the six kinds, a long
// title, and a reference the second product does not have.
const productColumns = [
  { key: 'title', header: 'Produit' },
  { key: 'reference', header: 'Référence' },
  { key: 'price', header: 'Prix', align: 'end' as const },
  { key: 'vat', header: 'TVA', align: 'end' as const },
  { key: 'state', header: 'État' },
]

const productRows = [
  {
    key: 1,
    cells: {
      title: { kind: 'strong' as const, value: 'Savon au miel de châtaignier' },
      reference: { kind: 'code' as const, value: 'SAV-MIEL-100' },
      price: { kind: 'number' as const, value: '6,90 €' },
      vat: { kind: 'number' as const, value: '20 %' },
      state: { kind: 'pill' as const, value: 'Publié', tone: 'accent' as const },
    },
  },
  {
    key: 2,
    cells: {
      title: {
        kind: 'strong' as const,
        value: 'Savon surgras à l’argile rose et à l’huile d’amande douce',
      },
      reference: { kind: 'code' as const },
      price: { kind: 'number' as const, value: '8,20 €' },
      vat: { kind: 'number' as const, value: '20 %' },
      state: { kind: 'pill' as const, value: 'Brouillon' },
    },
  },
  {
    key: 3,
    cells: {
      title: { kind: 'strong' as const, value: 'Coffret découverte' },
      reference: { kind: 'code' as const, value: 'COF-DEC-003' },
      price: { kind: 'number' as const, value: '24,00 €' },
      vat: { kind: 'number' as const },
      state: { kind: 'pill' as const, value: 'Retiré' },
    },
  },
]

// The rates, which is where a cell has to be described per row: the same
// column carries a pill on the default rate and a button on the others.
const rateColumns = [
  { key: 'name', header: 'Nom' },
  { key: 'rate', header: 'Taux', align: 'end' as const },
  { key: 'mark', header: '', align: 'end' as const },
  { key: 'act', header: '', align: 'end' as const },
]

const noop = (): void => {}

const rateRows = [
  {
    key: 'standard',
    cells: {
      name: { kind: 'strong' as const, value: 'Standard' },
      rate: { kind: 'number' as const, value: '20 %' },
      mark: { kind: 'pill' as const, value: 'Par défaut', tone: 'accent' as const },
      act: {
        kind: 'actions' as const,
        actions: [{ label: 'Supprimer Standard', icon: IconTrash, onPress: noop }],
      },
    },
  },
  {
    key: 'reduced',
    cells: {
      name: { kind: 'strong' as const, value: 'Réduit' },
      rate: { kind: 'number' as const, value: '5,5 %' },
      mark: {
        kind: 'actions' as const,
        actions: [{ label: 'Rendre par défaut', onPress: noop }],
      },
      act: {
        kind: 'actions' as const,
        actions: [{ label: 'Supprimer Réduit', icon: IconTrash, onPress: noop }],
      },
    },
  },
]
</script>

<template>
  <!-- Written in French and exempt from i18n, in a document whose `lang`
       follows the reader's interface language. Saying so here is what keeps a
       screen reader from pronouncing it as English, and what makes
       `text-transform` capitalise it under French rules. -->
  <div
    class="gallery"
    lang="fr"
  >
    <GalleryMenu />

    <Page
      class="pages"
      title="Composants"
      description="Tous les composants partagés, chacun avec ses états. Ce que cette page ne montre pas n’a pas été regardé."
    >
      <template #action>
        <Stack
          direction="row"
          :gap="2"
          align="center"
        >
          <LanguagePicker bare />
          <ThemePicker bare />
        </Stack>
      </template>

      <!-- ── Fondations ─────────────────────────────────────── -->

      <GallerySection
        name="Typographie"
        contract="Sept styles nommés par leur rôle. Chacun porte sa taille, son interligne, sa graisse et sa couleur ; on le consomme entier."
      >
        <GalleryCanvas stacked>
          <p class="text-title">
            Catalogue
          </p>
          <p class="text-heading">
            La Fabrique à Savons
          </p>
          <p class="text-body">
            Un savon surgras saponifié à froid, à l’huile d’olive et au miel de
            châtaignier.
          </p>
          <p class="text-body-strong">
            Savon au miel de châtaignier
          </p>
          <p class="text-caption">
            Contient 1,15 € de TVA — 5,75 € hors taxe.
          </p>
          <p class="text-caption-strong">
            Publié
          </p>
          <p class="text-label">
            Référence
          </p>
        </GalleryCanvas>
      </GallerySection>

      <!-- ── Disposition ────────────────────────────────────── -->

      <GallerySection
        name="Stack"
        contract="Une direction, un pas d’espacement. Le pas vient de l’échelle, jamais une longueur."
      >
        <GalleryCanvas>
          <GalleryVariant label="column, gap=2">
            <Stack :gap="2">
              <Button variant="quiet">
                Premier
              </Button>
              <Button variant="quiet">
                Deuxième
              </Button>
            </Stack>
          </GalleryVariant>
          <GalleryVariant label="row, align=center">
            <Stack
              direction="row"
              :gap="3"
              align="center"
            >
              <Button variant="primary">
                Enregistrer
              </Button>
              <Button variant="quiet">
                Annuler
              </Button>
            </Stack>
          </GalleryVariant>
          <GalleryVariant label="row, justify=between">
            <Stack
              direction="row"
              :gap="3"
              justify="between"
              align="center"
            >
              <span>Total</span>
              <span>6,90 €</span>
            </Stack>
          </GalleryVariant>
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="Grid"
        contract="Reflux depuis une largeur de colonne minimale. Jamais un nombre de colonnes."
      >
        <GalleryCanvas>
          <Grid
            :min-column="7"
            style="width: 100%"
          >
            <Button variant="quiet">
              Une
            </Button>
            <Button variant="quiet">
              Deux
            </Button>
            <Button variant="quiet">
              Trois
            </Button>
            <Button variant="quiet">
              Quatre
            </Button>
            <Button variant="quiet">
              Cinq
            </Button>
          </Grid>
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="Page"
        contract="Titre, description facultative, action à côté du titre. Compose PageTitle."
      >
        <GalleryCanvas stacked>
          <Page
            title="Catalogue"
            description="Les produits que la boutique vend, publiés ou non."
          >
            <template #action>
              <Button variant="primary">
                Ajouter un produit
              </Button>
            </template>
            <span>Le contenu de l’écran.</span>
          </Page>
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="PageTitle"
        contract="Le titre d’un écran. Le composant précis que Page compose."
      >
        <GalleryCanvas>
          <GalleryVariant label="court">
            <PageTitle>Réglages</PageTitle>
          </GalleryVariant>
          <GalleryVariant label="long, équilibré sur deux lignes">
            <PageTitle>{{ overflowing }}</PageTitle>
          </GalleryVariant>
        </GalleryCanvas>
      </GallerySection>

      <!-- ── Données ────────────────────────────────────────── -->

      <GallerySection
        name="Table"
        contract="Des lignes de cellules typées — texte, identité, nombre, code, pastille, actions — et rien d’autre. Sous 768 px chaque ligne devient une carte, et une seule des deux formes est dans le document."
      >
        <GalleryCanvas>
          <Table
            style="width: 100%"
            :columns="productColumns"
            :rows="productRows"
            empty="Aucun produit pour l’instant."
            label="Produits"
          />
        </GalleryCanvas>

        <GalleryCanvas>
          <Table
            style="width: 100%"
            :columns="rateColumns"
            :rows="rateRows"
            empty="Aucun taux pour l’instant."
            label="Taux de TVA"
          />
        </GalleryCanvas>

        <GalleryCanvas>
          <Table
            style="width: 100%"
            :columns="productColumns"
            :rows="[]"
            empty="Aucun produit pour l’instant."
            label="Produits, sans aucun"
          />
        </GalleryCanvas>
      </GallerySection>

      <!-- ── Actions ────────────────────────────────────────── -->

      <GallerySection
        name="Button"
        contract="Une action. primary une par écran, quiet à côté, link pour une action déguisée en lien, icon pour une cible carrée."
      >
        <GalleryCanvas>
          <Button variant="primary">
            primary
          </Button>
          <Button variant="quiet">
            quiet
          </Button>
          <Button variant="link">
            link
          </Button>
          <Button
            variant="icon"
            aria-label="icon, avec aria-label"
          >
            <IconMenu />
          </Button>
          <Button
            variant="primary"
            busy
          >
            busy
          </Button>
          <Button
            variant="primary"
            disabled
          >
            disabled
          </Button>
          <Button
            variant="quiet"
            disabled
          >
            quiet disabled
          </Button>
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="NavLink"
        contract="Une navigation vers une route. Ce qui change de page est un lien, pas un bouton."
      >
        <GalleryCanvas>
          <NavLink to="/dev/design-system">
            au repos
          </NavLink>
        </GalleryCanvas>
      </GallerySection>

      <!-- ── Champs ─────────────────────────────────────────── -->

      <GallerySection
        name="TextField"
        contract="Une ligne, ou plusieurs avec multiline. L’erreur se lit à côté du libellé, jamais dessous."
      >
        <GalleryCanvas stacked>
          <TextField
            :model-value="''"
            label="vide"
          />
          <TextField
            v-model="title"
            :icon="IconCatalogue"
            label="rempli, avec icône"
          />
          <TextField
            :model-value="''"
            optional
            label="facultatif"
          />
          <TextField
            :model-value="'sav'"
            label="refusé"
            error="déjà pris"
          />
          <TextField
            :model-value="'6,90'"
            label="avec suffixe"
            suffix="TTC"
          />
          <TextField
            v-model="overflowing"
            label="texte plus long que le champ"
          />
          <TextField
            v-model="email"
            type="email"
            :icon="IconMail"
            label="avec indication"
            hint="Celle où la boutique écrit."
          />
          <TextField
            :model-value="'Un savon surgras, saponifié à froid, à l’huile d’olive et au miel de châtaignier récolté en Ardèche.'"
            multiline
            optional
            label="multiline"
          />
          <TextField
            :model-value="'EUR'"
            label="disabled"
            disabled
          />
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="SelectField"
        contract="Un choix parmi une liste connue. bare quand il siège dans une barre plutôt que dans un formulaire."
      >
        <GalleryCanvas stacked>
          <SelectField
            v-model="rate"
            :icon="IconReceipt"
            :options="rates"
            label="au repos"
          />
          <SelectField
            v-model="rate"
            :options="rates"
            label="refusé"
            error="ce taux a été supprimé"
          />
          <SelectField
            v-model="rate"
            :options="rates"
            label="disabled"
            disabled
          />
          <SelectField
            v-model="rate"
            :options="rates"
            label="bare, dans une barre"
            bare
          />
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="CheckboxField"
        contract="Un oui ou un non. Son libellé dit ce qui arrive quand il est coché."
      >
        <GalleryCanvas stacked>
          <CheckboxField
            v-model="publish"
            label="décoché"
          />
          <CheckboxField
            :model-value="true"
            label="coché"
          />
          <CheckboxField
            :model-value="false"
            label="disabled"
            disabled
          />
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="PasswordField"
        contract="Un mot de passe, masqué, avec une barre de force quand la boutique le juge."
      >
        <GalleryCanvas stacked>
          <PasswordField
            v-model="secret"
            :icon="IconLock"
            label="vide, avec force"
            strength
          />
          <PasswordField
            v-model="weak"
            :icon="IconLock"
            label="faible"
            strength
          />
          <PasswordField
            :model-value="'motdepasse123'"
            label="refusé par la boutique"
            strength
            error="trop courant"
          />
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="FieldFrame"
        contract="La bordure encochée que tous les champs partagent. Montrée seule parce que ses états sont ceux de tous les champs à la fois."
      >
        <GalleryCanvas stacked>
          <FieldFrame
            control-id="kit-frame-rest"
            floating
            label="au repos"
          >
            <span>Une valeur</span>
          </FieldFrame>
          <FieldFrame
            control-id="kit-frame-invalid"
            floating
            label="invalide"
            invalid
            error="ce que la boutique reproche"
          >
            <span>Une valeur</span>
          </FieldFrame>
          <FieldFrame
            control-id="kit-frame-valid"
            floating
            label="valide"
            valid
          >
            <span>Une valeur</span>
          </FieldFrame>
          <FieldFrame
            control-id="kit-frame-disabled"
            floating
            label="disabled"
            disabled
          >
            <span>Une valeur</span>
          </FieldFrame>
        </GalleryCanvas>
      </GallerySection>

      <!-- ── Coquille ───────────────────────────────────────── -->

      <GallerySection
        name="AppBar"
        contract="La barre du haut : le titre de la surface, et ce qu’on lui donne."
      >
        <GalleryCanvas>
          <AppBar
            title="Catalogue"
            style="width: 100%"
          />
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="Drawer"
        contract="Un dialogue modal glissé depuis la gauche. Le navigateur y tient le focus et le ferme sur Échap."
      >
        <GalleryCanvas>
          <Button
            variant="quiet"
            @click="drawerOpen = true"
          >
            fermé — presser pour ouvrir
          </Button>
          <Drawer
            :open="drawerOpen"
            label="Sections"
            @close="drawerOpen = false"
          >
            <Stack :gap="2">
              <NavLink to="/dev/design-system">
                Tableau de bord
              </NavLink>
              <NavLink to="/dev/design-system">
                Catalogue
              </NavLink>
              <NavLink to="/dev/design-system">
                Réglages
              </NavLink>
            </Stack>
          </Drawer>
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="LanguagePicker"
        contract="La langue de l’interface. Encadré sur une page de réglages, sans cadre dans une barre — et le libellé change avec : le nom de la langue ici, son code là."
      >
        <GalleryCanvas>
          <GalleryVariant label="encadré, sur une page de réglages">
            <LanguagePicker />
          </GalleryVariant>
          <GalleryVariant label="bare, dans une barre">
            <LanguagePicker bare />
          </GalleryVariant>
        </GalleryCanvas>
      </GallerySection>

      <GallerySection
        name="ThemePicker"
        contract="Clair, sombre, ou celui du système. Le troisième est le défaut, et c’est lui qui suit la préférence du navigateur."
      >
        <GalleryCanvas>
          <GalleryVariant label="encadré, sur une page de réglages">
            <ThemePicker />
          </GalleryVariant>
          <GalleryVariant label="bare, dans une barre">
            <ThemePicker bare />
          </GalleryVariant>
        </GalleryCanvas>
      </GallerySection>
    </Page>
  </div>
</template>

<style scoped>
.gallery {
  display: flex;
  gap: var(--space-8);
  max-width: 74rem;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

/* The one that shrinks: without this the sections push the menu off the page
   rather than wrapping inside their own column. */
.pages {
  min-width: 0;
  flex: 1;
}
</style>
