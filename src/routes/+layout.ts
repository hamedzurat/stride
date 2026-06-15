//     .|||||||||.
//    |||||||||||||
//   |||||||||||' .\
//   `||||||||||_,__o

import posthog from 'posthog-js';

import { browser } from '$app/environment';

export const load = async () => {
  if (browser && !import.meta.env.DEV) {
    posthog.init('phc_EEAVrVpMoYP4EIgweA9bvsuisrLmln8xpPUGwrW4Joj', {
      api_host: 'https://bish-le-shon.zurat.dev',
      defaults: '2026-01-30',
    });
  }

  return;
};
