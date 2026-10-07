// Daily background analysis is retired. Only the open app requests insights.
// @ts-ignore - Deno edge function import.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleDisabledAdvisorDaily } from './handler.ts';

serve(handleDisabledAdvisorDaily);
