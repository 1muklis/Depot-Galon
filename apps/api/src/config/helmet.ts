import helmet from 'helmet';

export const helmetMiddleware = helmet({
  // uploads dipakai lintas-origin oleh frontend
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
});
