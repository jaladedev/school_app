# syntax=docker/dockerfile:1
#
# One image for every school. Nothing school-specific is baked in: the container
# reads SUPABASE_URL, SUPABASE_ANON_KEY, PAYSTACK_PUBLIC_KEY and the secret keys
# from its environment at start-up (see deploy/school.env.example).

FROM node:22-alpine AS deps
WORKDIR /app
# The postinstall script copies the MathLive fonts into public/, so it has to be
# present before npm ci runs.
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Syntactically valid placeholders so the build can import the modules that
# validate their environment. They exist only in this build stage, use the
# runtime names (not NEXT_PUBLIC_*), and are not read again at run time.
ENV SUPABASE_URL=https://build.invalid \
    SUPABASE_ANON_KEY=build-placeholder \
    SUPABASE_SERVICE_ROLE_KEY=build-placeholder \
    PAYSTACK_PUBLIC_KEY=pk_test_build_placeholder \
    PAYSTACK_SECRET_KEY=sk_test_build_placeholder \
    R2_ENDPOINT=https://build.invalid \
    R2_BUCKET=build-placeholder \
    R2_ACCESS_KEY_ID=build-placeholder \
    R2_SECRET_ACCESS_KEY=build-placeholder
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Set last so a new tag does not invalidate the layers above. Reported by
# /api/health so the dashboard can record which version each school runs.
ARG IMAGE_TAG=dev
ENV IMAGE_TAG=$IMAGE_TAG
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
