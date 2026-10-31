import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { HeadHunterPage } from '@/components/headhunter';

export const Route = createFileRoute('/_app/headhunter')({
  validateSearch: z.object({ connection: z.enum(['connected', 'cancelled', 'failed']).optional() }),
  component: HeadHunterPage,
});
