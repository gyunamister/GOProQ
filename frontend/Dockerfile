ARG BUILD_ENV

FROM node:18.13.0-slim@sha256:bc946484118735406562f17c57ddf5fded436e175b6a51f827aa6540ba1e13de as common_pre_build
ONBUILD WORKDIR /ocpq/webserver
ONBUILD COPY package.json .
ONBUILD COPY package-lock.json .
ONBUILD RUN npm ci

FROM common_pre_build as prod_build
ONBUILD COPY public/ public/
ONBUILD COPY src/ src/
ONBUILD COPY tsconfig.json .
# TODO: uncomment once frontend (e.g. api.ts `API_BASE_URL`) supports production mode using nginx reverse proxy
#ONBUILD ENV NODE_ENV production

FROM common_pre_build as dev_build

FROM ${BUILD_ENV}_build
CMD PORT=3000 npm run start
