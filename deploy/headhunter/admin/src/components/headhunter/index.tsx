import { useEffect, useState } from 'react';
import { Button, TextField } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import type * as t from '@/types';
import { useCapabilities, useLocalize } from '@/hooks';
import { AccessDenied, LoadingState, PermissionsUnavailable } from '@/components/shared';
import { PasswordInput } from '@/components/PasswordInput';
import { SystemCapabilities } from '@/constants';
import {
  getHeadHunterFn,
  saveHeadHunterFn,
  authorizeHeadHunterFn,
  testHeadHunterFn,
  disconnectHeadHunterFn,
  cancelHeadHunterFn,
} from '@/server';

const queryKey = ['headHunterIntegration'] as const;
const Route = getRouteApi('/_app/headhunter');
const knownErrors = new Set([
  'forbidden',
  'service_unavailable',
  'invalid_settings',
  'secret_required',
  'save_failed',
  'not_configured',
  'expired_state',
  'authorization_failed',
  'not_connected',
  'employer_required',
  'verification_failed',
  'disconnect_failed',
]);

export function HeadHunterPage() {
  const localize = useLocalize();
  const { connection } = Route.useSearch();
  const { hasCapability, isLoading, isError } = useCapabilities();
  const canManage = hasCapability(SystemCapabilities.MANAGE_CONFIGS);
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const status = useQuery({
    queryKey,
    queryFn: () => getHeadHunterFn(),
    enabled: canManage,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (action: 'save' | 'authorize' | 'test' | 'disconnect' | 'cancel') => {
      switch (action) {
        case 'save':
          return saveHeadHunterFn({ data: { clientId, clientSecret: clientSecret || undefined } });
        case 'authorize':
          return authorizeHeadHunterFn();
        case 'test':
          return testHeadHunterFn();
        case 'disconnect':
          return disconnectHeadHunterFn();
        case 'cancel':
          return cancelHeadHunterFn();
      }
    },
    onMutate: () => setMessage(''),
    onSuccess: (result, action) => {
      if (result && 'url' in result) {
        window.location.assign(result.url);
        return;
      }
      if (result) queryClient.setQueryData(queryKey, result);
      if (action === 'save') {
        setClientSecret('');
        setDirty(false);
      }
      if (action === 'cancel') void queryClient.invalidateQueries({ queryKey });
      setMessage(`com_hh_${action}_success`);
    },
  });
  useEffect(() => {
    if (status.data && !dirty) setClientId(status.data.clientId);
  }, [status.data, dirty]);

  const errorText = (error: Error) => {
    const code = knownErrors.has(error.message) ? error.message : 'service_unavailable';
    return localize(`com_hh_error_${code}` as t.TranslationKeys);
  };

  if (isLoading) return <LoadingState />;
  if (isError) return <PermissionsUnavailable />;
  if (!canManage) return <AccessDenied />;
  if (status.isPending) return <LoadingState />;
  if (status.isError)
    return (
      <div className="flex flex-col gap-4 p-6">
        <p role="alert">{errorText(status.error)}</p>
        <Button
          type="secondary"
          label={localize('com_hh_retry')}
          onClick={() => {
            void status.refetch();
          }}
        />
      </div>
    );
  if (!status.data.available)
    return (
      <p className="p-6" role="status">
        {localize('com_hh_unavailable')}
      </p>
    );

  const busy = mutation.isPending;
  const data = status.data;
  const canSave = Boolean(
    clientId.trim() &&
    (data.configured || clientSecret.trim()) &&
    (clientId.trim() === data.clientId || clientSecret.trim()),
  );
  let statusKey: t.TranslationKeys = 'com_hh_empty';
  if (data.configured) statusKey = 'com_hh_ready';
  if (data.connected) statusKey = 'com_hh_connected';

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6 p-6" aria-labelledby="hh-title">
      <div className="flex flex-col gap-2">
        <h2 id="hh-title" className="text-xl font-semibold">
          {localize('com_hh_title')}
        </h2>
        <p className="text-sm text-(--cui-color-text-muted)">{localize('com_hh_description')}</p>
        <a
          href="https://dev.hh.ru/admin"
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          {localize('com_hh_developer_account')}
        </a>
      </div>

      <div className="flex flex-col gap-2" role="status" aria-live="polite">
        <p>{localize(statusKey)}</p>
        {data.authorizationPending && <p>{localize('com_hh_pending')}</p>}
        {data.account && (
          <p>
            {data.account.name} · {data.account.employer.name || data.account.employer.id}
          </p>
        )}
        {connection === 'failed' && <p>{localize('com_hh_callback_failed')}</p>}
        {connection === 'cancelled' && <p>{localize('com_hh_cancel_success')}</p>}
        {message && <p>{localize(message as t.TranslationKeys)}</p>}
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-(--cui-color-text-danger)">
          {errorText(mutation.error)}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <TextField
          id="hh-client-id"
          name="hh-client-id"
          label={localize('com_hh_client_id')}
          value={clientId}
          disabled={busy}
          autoComplete="off"
          onChange={(value) => {
            setClientId(value);
            setDirty(true);
          }}
        />
        <PasswordInput
          id="hh-client-secret"
          name="hh-client-secret"
          label={localize('com_hh_client_secret')}
          value={clientSecret}
          disabled={busy}
          autoComplete="new-password"
          placeholder={localize(
            data.configured ? 'com_hh_secret_saved' : 'com_hh_secret_placeholder',
          )}
          onChange={(value) => {
            setClientSecret(value);
            setDirty(true);
          }}
        />
        <p className="text-sm text-(--cui-color-text-muted)">{localize('com_hh_secret_help')}</p>
        {clientId.trim() !== data.clientId && !clientSecret.trim() && (
          <p className="text-sm" role="status">
            {localize('com_hh_error_secret_required')}
          </p>
        )}
        <TextField
          id="hh-redirect-uri"
          label={localize('com_hh_redirect_uri')}
          value={data.redirectUri}
          onChange={() => {}}
          readOnly
        />
        <p className="text-sm text-(--cui-color-text-muted)">{localize('com_hh_redirect_help')}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="secondary"
            label={localize('com_hh_copy_callback')}
            onClick={() => {
              void navigator.clipboard
                .writeText(data.redirectUri)
                .then(() => setMessage('com_hh_copied'))
                .catch(() => setMessage('com_hh_copy_failed'));
            }}
          />
          <Button
            type="primary"
            label={localize('com_hh_save')}
            loading={busy && mutation.variables === 'save'}
            disabled={busy || !canSave || (!dirty && !data.needsMigration)}
            onClick={() => mutation.mutate('save')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-(--cui-color-stroke-default) pt-5">
        <p className="text-sm text-(--cui-color-text-muted)">{localize('com_hh_account_help')}</p>
        {(dirty || data.needsMigration) && (
          <p className="text-sm" role="status">
            {localize('com_hh_save_first')}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="primary"
            label={localize(data.connected ? 'com_hh_reconnect' : 'com_hh_authorize')}
            disabled={busy || !data.configured || dirty || data.needsMigration}
            loading={busy && mutation.variables === 'authorize'}
            onClick={() => mutation.mutate('authorize')}
          />
          <Button
            type="secondary"
            label={localize('com_hh_test')}
            disabled={busy || !data.connected || data.authorizationPending}
            loading={busy && mutation.variables === 'test'}
            onClick={() => mutation.mutate('test')}
          />
          {data.connected && (
            <Button
              type="secondary"
              label={localize('com_hh_disconnect')}
              disabled={busy}
              onClick={() => mutation.mutate('disconnect')}
            />
          )}
          {data.authorizationPending && (
            <Button
              type="secondary"
              label={localize('com_hh_cancel')}
              disabled={busy}
              onClick={() => mutation.mutate('cancel')}
            />
          )}
        </div>
      </div>
    </section>
  );
}
