import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import type * as t from '@/types';
import { getEffectiveCapabilitiesFn } from './capabilities';
import { hasImpliedCapability, SystemCapabilities } from '@/constants';
import { useAppSession } from './session';

const settingsSchema = z
  .object({
    clientId: z.string().trim().min(1).max(256),
    clientSecret: z.string().trim().max(4096).optional(),
  })
  .strict();
const callbackSchema = z
  .object({
    code: z.string().max(4096).optional(),
    state: z.string().max(128).optional(),
    error: z.string().max(256).optional(),
  })
  .strict();

const errorCodes = new Set([
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

async function requireHeadHunterManager(): Promise<void> {
  const { capabilities } = await getEffectiveCapabilitiesFn();
  if (
    !hasImpliedCapability(capabilities, SystemCapabilities.ACCESS_ADMIN) ||
    !hasImpliedCapability(capabilities, SystemCapabilities.MANAGE_CONFIGS)
  ) {
    throw new Error('forbidden');
  }
}

async function managementRequest<T>(
  path: string,
  method = 'GET',
  body?: t.HeadHunterSettings | t.HeadHunterCallback,
): Promise<T> {
  const base = process.env.HH_ADMIN_URL;
  const token = process.env.HH_ADMIN_TOKEN;
  if (!base || !token) throw new Error('service_unavailable');
  const response = await fetch(`${base.replace(/\/$/, '')}/${path}`, {
    method,
    redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new Error('service_unavailable');
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      result.error && errorCodes.has(result.error) ? result.error : 'service_unavailable',
    );
  }
  return (await response.json()) as T;
}

export const getHeadHunterFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<t.HeadHunterStatus> => {
    await requireHeadHunterManager();
    if (!process.env.HH_ADMIN_URL || !process.env.HH_ADMIN_TOKEN) {
      return {
        available: false,
        configured: false,
        connected: false,
        renewable: false,
        clientId: '',
        redirectUri: '',
      };
    }
    const session = await useAppSession();
    const authorizationPending = Boolean(
      session.data.hhOAuthState &&
      session.data.hhOAuthUserId === session.data.user?.id &&
      session.data.hhOAuthStartedAt &&
      Date.now() - session.data.hhOAuthStartedAt < 600_000,
    );
    return {
      ...(await managementRequest<t.HeadHunterStatus>('settings')),
      available: true,
      authorizationPending,
    };
  },
);

export const saveHeadHunterFn = createServerFn({ method: 'POST' })
  .inputValidator(settingsSchema)
  .handler(async ({ data }): Promise<t.HeadHunterStatus> => {
    await requireHeadHunterManager();
    const status = await managementRequest<t.HeadHunterStatus>('settings', 'PUT', data);
    const session = await useAppSession();
    await session.update({
      hhOAuthState: undefined,
      hhOAuthStartedAt: undefined,
      hhOAuthUserId: undefined,
    });
    return { ...status, available: true, authorizationPending: false };
  });

export const authorizeHeadHunterFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ url: string }> => {
    await requireHeadHunterManager();
    const session = await useAppSession();
    if (!session.data.user?.id) throw new Error('forbidden');
    if (session.data.hhOAuthState) {
      await managementRequest('cancel', 'POST', { state: session.data.hhOAuthState });
    }
    const state = randomBytes(32).toString('hex');
    const result = await managementRequest<{ url: string }>('authorize', 'POST', { state });
    await session.update({
      hhOAuthState: state,
      hhOAuthStartedAt: Date.now(),
      hhOAuthUserId: session.data.user.id,
    });
    return result;
  },
);

export const cancelHeadHunterFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<void> => {
    await requireHeadHunterManager();
    const session = await useAppSession();
    const state = session.data.hhOAuthState;
    await session.update({
      hhOAuthState: undefined,
      hhOAuthStartedAt: undefined,
      hhOAuthUserId: undefined,
    });
    if (state) await managementRequest('cancel', 'POST', { state });
  },
);

export const finishHeadHunterFn = createServerFn({ method: 'POST' })
  .inputValidator(callbackSchema)
  .handler(async ({ data }): Promise<{ connection: 'connected' | 'cancelled' | 'failed' }> => {
    await requireHeadHunterManager();
    const session = await useAppSession();
    const state = session.data.hhOAuthState;
    const started = session.data.hhOAuthStartedAt;
    if (
      !state ||
      state !== data.state ||
      !started ||
      Date.now() - started >= 600_000 ||
      session.data.hhOAuthUserId !== session.data.user?.id
    ) {
      return { connection: 'failed' };
    }
    await session.update({
      hhOAuthState: undefined,
      hhOAuthStartedAt: undefined,
      hhOAuthUserId: undefined,
    });
    if (data.error || !data.code) {
      await managementRequest('cancel', 'POST', { state }).catch(() => undefined);
      return { connection: 'cancelled' };
    }
    try {
      await managementRequest('exchange', 'POST', { code: data.code, state });
      return { connection: 'connected' };
    } catch {
      return { connection: 'failed' };
    }
  });

export const testHeadHunterFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<t.HeadHunterStatus> => {
    await requireHeadHunterManager();
    return { ...(await managementRequest<t.HeadHunterStatus>('test', 'POST')), available: true };
  },
);

export const disconnectHeadHunterFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<t.HeadHunterStatus> => {
    await requireHeadHunterManager();
    const status = await managementRequest<t.HeadHunterStatus>('disconnect', 'POST');
    const session = await useAppSession();
    await session.update({
      hhOAuthState: undefined,
      hhOAuthStartedAt: undefined,
      hhOAuthUserId: undefined,
    });
    return { ...status, available: true, authorizationPending: false };
  },
);
