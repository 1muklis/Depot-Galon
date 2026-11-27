// Nilai uji; DATABASE_URL asli hanya dipakai bila tersedia (integration/e2e dengan DB)
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0000';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret-000';
process.env.ENABLE_JOBS = 'false';
process.env.ENABLE_DOCS = 'false';
