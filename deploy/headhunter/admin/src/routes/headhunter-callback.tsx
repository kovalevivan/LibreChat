import { z } from 'zod';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { finishHeadHunterFn } from '@/server';

export const Route = createFileRoute('/headhunter-callback')({
  validateSearch: z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await finishHeadHunterFn({ data: deps }).catch(() => ({
      connection: 'failed' as const,
    }));
    throw redirect({ to: '/headhunter', search: result, replace: true });
  },
});
