<script setup lang="ts">
/**
 * App-settings section to register, edit and remove ODK Central servers and to
 * save each server's password (encrypted through the credential vault).
 *
 * This is the only place a Central server is created, so it is also the entry
 * point for the whole networked feature: with no server the Publish button and
 * the import "From Central" source stay hidden. The `/settings` route is absent
 * in embed mode, so this section is embed-safe for free.
 *
 * Editing name / URL / email auto-commits on blur (`@change`) — trivial local
 * edits do not warrant a save button. The password is different: it needs the
 * vault-unlock ceremony, so it has its own explicit "Save password" action.
 * Nothing here touches the network on its own; connecting is user-initiated.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, reactive, watch } from 'vue'

import { connectionLabel } from '@/components/central/connection'
import { useAppI18n } from '@/i18n'
import { centralErrorKey } from '@/i18n/central-errors'
import { useCentralStore } from '@/stores/central'
import type { CentralServerInput } from '@/persistence/central-servers-repo'
import type { CentralServerRecord } from '@/persistence/db'

const central = useCentralStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useAppI18n()

/** Per-row editable state, kept out of the store so a `liveQuery` re-emit never
 *  clobbers an in-progress edit. Keyed by server id. */
interface ServerForm {
  name: string
  baseUrl: string
  email: string
  password: string
  nameError: string
  urlError: string
  passwordError: string
  savingPassword: boolean
}

const forms = reactive<Record<string, ServerForm>>({})

const makeForm = (record: CentralServerRecord): ServerForm => ({
  name: record.name,
  baseUrl: record.baseUrl,
  email: record.email ?? '',
  password: '',
  nameError: '',
  urlError: '',
  passwordError: '',
  savingPassword: false,
})

// Seed a form for each server the first time it appears; prune removed ones.
// Never overwrite an existing form (that would discard the user's live edits).
watch(() => central.servers, (servers) => {
  for (const server of servers) {
    if (!(server.id in forms)) forms[server.id] = makeForm(server)
  }
  for (const id of Object.keys(forms)) {
    if (!servers.some((server) => server.id === id)) delete forms[id]
  }
}, { immediate: true })

onMounted(() => {
  // Idempotent — the app-global store usually watches already, but a direct
  // #/settings navigation may be the first time the list is needed.
  central.startWatching()
})

const rows = computed(() =>
  central.servers
    .map((server) => ({ server, form: forms[server.id] }))
    .filter((row): row is { server: CentralServerRecord, form: ServerForm } => row.form !== undefined))

// --- validation -------------------------------------------------------------

/**
 * Treat the base URL as opaque (path prefixes are preserved by the client) and
 * only gate the scheme: plain http is allowed for loopback, everything else
 * must be https.
 */
const validateUrl = (raw: string): string => {
  const value = raw.trim()
  if (value === '') return t('central.servers.urlRequired')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return t('central.servers.urlInvalid')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return t('central.servers.urlInvalid')
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    return t('central.servers.urlHttpsRequired')
  }
  return ''
}

// --- error surfacing --------------------------------------------------------

const toastError = (error: unknown): void => {
  toast.add({ severity: 'error', summary: t('central.errors.title'), detail: t(centralErrorKey(error)), life: 4000 })
}

// --- server CRUD ------------------------------------------------------------

const addServer = async (): Promise<void> => {
  try {
    // A blank row the user fills in; each field auto-commits on blur.
    await central.saveServer({ name: '', baseUrl: '' })
  } catch (error) {
    toastError(error)
  }
}

/** Commit name / URL / email edits (blur/enter). Skips persistence while the
 *  name or URL is invalid, surfacing the message inline instead. Spreads the
 *  stored record so the encrypted password is preserved across an edit. */
const commit = async (server: CentralServerRecord, form: ServerForm): Promise<void> => {
  form.nameError = form.name.trim() === '' ? t('central.servers.nameRequired') : ''
  form.urlError = validateUrl(form.baseUrl)
  if (form.nameError !== '' || form.urlError !== '') return
  const email = form.email.trim()
  const input: CentralServerInput = {
    ...server,
    id: server.id,
    name: form.name.trim(),
    baseUrl: form.baseUrl.trim(),
    email: email === '' ? undefined : email,
  }
  try {
    await central.saveServer(input)
  } catch (error) {
    toastError(error)
  }
}

const removeServer = (server: CentralServerRecord): void => {
  confirm.require({
    header: t('central.servers.removeServer'),
    message: t('central.servers.removeConfirm', { name: server.name }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('central.servers.removeConfirmAccept'),
    rejectLabel: t('common.cancel'),
    acceptProps: { severity: 'danger', 'data-testid': 'central-server-remove-confirm' },
    accept: () => { void performRemove(server) },
  })
}

const performRemove = async (server: CentralServerRecord): Promise<void> => {
  try {
    await central.deleteCentralServer(server.id)
    delete forms[server.id]
    toast.add({ severity: 'success', summary: t('central.servers.removed'), life: 2000 })
  } catch (error) {
    toastError(error)
  }
}

// --- password ---------------------------------------------------------------

const savePassword = async (server: CentralServerRecord, form: ServerForm): Promise<void> => {
  if (form.password.length === 0) {
    form.passwordError = t('central.servers.passwordRequired')
    return
  }
  form.passwordError = ''
  try {
    // Open the unlock prompt up front so a cancel stays silent (rather than
    // surfacing as a spurious "sign-in failed" from the reject path).
    await central.ensureUnlocked()
  } catch {
    return
  }
  form.savingPassword = true
  try {
    await central.saveServerPassword(server.id, form.password)
    form.password = ''
    toast.add({ severity: 'success', summary: t('central.servers.passwordSaved'), life: 2000 })
  } catch (error) {
    toastError(error)
  } finally {
    form.savingPassword = false
  }
}

// --- connection -------------------------------------------------------------

const canConnect = (server: CentralServerRecord): boolean =>
  server.encryptedPassword !== undefined && server.email !== undefined && server.email !== ''

const isConnecting = (server: CentralServerRecord): boolean =>
  central.connectionState(server.id).status === 'connecting'

const testConnection = async (server: CentralServerRecord): Promise<void> => {
  try {
    await central.ensureUnlocked()
  } catch {
    return // unlock cancelled
  }
  try {
    await central.connect(server.id)
    toast.add({ severity: 'success', summary: t('central.connection.connected', { name: server.name }), life: 2000 })
  } catch (error) {
    toastError(error)
  }
}

const disconnect = async (server: CentralServerRecord): Promise<void> => {
  try {
    await central.disconnect(server.id)
    toast.add({ severity: 'info', summary: t('central.connection.disconnected', { name: server.name }), life: 2000 })
  } catch (error) {
    toastError(error)
  }
}
</script>

<template>
  <section class="settings-section" data-testid="settings-central">
    <h2>{{ t('central.servers.heading') }}</h2>
    <p class="settings-note">{{ t('central.servers.description') }}</p>

    <p v-if="rows.length === 0" class="settings-note" data-testid="central-empty">
      {{ t('central.servers.empty') }}
    </p>

    <div
      v-for="{ server, form } in rows"
      :key="server.id"
      class="central-server"
      :data-testid="`central-server-row-${server.id}`"
    >
      <div class="central-grid">
        <label class="prop-field">
          <span>{{ t('central.servers.nameLabel') }}</span>
          <InputText
            v-model="form.name"
            :placeholder="t('central.servers.namePlaceholder')"
            data-testid="central-server-name"
            @change="commit(server, form)"
          />
          <small v-if="form.nameError !== ''" class="prop-issue" data-testid="central-server-name-error">
            {{ form.nameError }}
          </small>
        </label>

        <label class="prop-field">
          <span>{{ t('central.servers.urlLabel') }}</span>
          <InputText
            v-model="form.baseUrl"
            class="mono"
            :placeholder="t('central.servers.urlPlaceholder')"
            data-testid="central-server-url"
            @change="commit(server, form)"
          />
          <small v-if="form.urlError !== ''" class="prop-issue" data-testid="central-server-url-error">
            {{ form.urlError }}
          </small>
        </label>

        <label class="prop-field">
          <span>{{ t('central.servers.emailLabel') }}</span>
          <InputText
            v-model="form.email"
            :placeholder="t('central.servers.emailPlaceholder')"
            data-testid="central-server-email"
            @change="commit(server, form)"
          />
        </label>

        <label class="prop-field">
          <span>{{ t('central.servers.passwordLabel') }}</span>
          <InputText
            v-model="form.password"
            type="password"
            autocomplete="off"
            :placeholder="t('central.servers.passwordPlaceholder')"
            data-testid="central-server-password"
            @keyup.enter="savePassword(server, form)"
          />
          <small v-if="form.passwordError !== ''" class="prop-issue" data-testid="central-server-password-error">
            {{ form.passwordError }}
          </small>
        </label>
      </div>

      <p class="central-hint">{{ t('central.servers.passwordHint') }}</p>

      <div class="central-actions">
        <div class="central-actions-group">
          <Button
            :label="t('central.servers.savePassword')"
            icon="pi pi-lock"
            size="small"
            severity="secondary"
            :loading="form.savingPassword"
            data-testid="central-server-save-password"
            @click="savePassword(server, form)"
          />
          <span class="central-muted">
            {{ server.encryptedPassword ? t('central.servers.passwordSaved') : t('central.servers.passwordMissing') }}
          </span>
        </div>

        <div class="central-actions-group">
          <span
            v-if="central.isConnected(server.id)"
            class="central-connected"
            data-testid="central-server-connection"
          >{{ connectionLabel(central, server.id) }}</span>
          <span v-else class="central-muted" data-testid="central-server-connection">
            {{ connectionLabel(central, server.id) }}
          </span>

          <Button
            v-if="central.isConnected(server.id)"
            :label="t('central.connection.disconnect')"
            size="small"
            severity="secondary"
            data-testid="central-server-disconnect"
            @click="disconnect(server)"
          />
          <Button
            v-else
            :label="isConnecting(server) ? t('central.connection.connecting') : t('central.connection.connect')"
            size="small"
            severity="secondary"
            :loading="isConnecting(server)"
            :disabled="!canConnect(server)"
            data-testid="central-server-test"
            @click="testConnection(server)"
          />
          <Button
            :label="t('central.servers.removeServer')"
            icon="pi pi-trash"
            size="small"
            severity="danger"
            text
            data-testid="central-server-remove"
            @click="removeServer(server)"
          />
        </div>
      </div>
    </div>

    <div>
      <Button
        :label="t('central.servers.addServer')"
        icon="pi pi-plus"
        size="small"
        data-testid="central-add-server"
        @click="addServer"
      />
    </div>
  </section>
</template>

<style scoped>
@import '../properties/prop-section.css';

/* Mirrors the SettingsView card styling so this section is visually identical
 * when composed into the settings page. */
.settings-section {
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-base-background-color);
  padding: var(--odk-spacing-l) var(--odk-spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.settings-section h2 {
  margin: 0;
  font-size: var(--odk-question-font-size);
}

.settings-note {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.central-server {
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  padding: var(--odk-spacing-l);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.central-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--odk-spacing-l);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.central-hint {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.central-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--odk-spacing-l);
}

.central-actions-group {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
}

.central-actions-group > :deep(.p-button) {
  flex-shrink: 0;
  white-space: nowrap;
}

.central-muted {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.central-connected {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-success-text-color, var(--odk-muted-text-color));
}
</style>
