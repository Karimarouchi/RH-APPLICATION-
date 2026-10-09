# Builds both React apps (RH + Projects) and serves them with nginx.
# Routing by hostname: rh.* -> RH app, project.* -> Projects app, /api + /uploads -> backend.
FROM node:20-alpine AS build-rh
WORKDIR /app
COPY frontend-rh/package.json frontend-rh/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend-rh/ ./
ARG RH_APP_URL=https://rh.antigoneinterne.agency
ARG PROJECTS_APP_URL=https://project.antigoneinterne.agency
ENV VITE_BASE=/ VITE_API_URL= VITE_APP_KIND=rh VITE_RH_APP_URL=$RH_APP_URL VITE_PROJECTS_APP_URL=$PROJECTS_APP_URL
RUN npm run build

FROM node:20-alpine AS build-projects
WORKDIR /app
COPY frontend-projects/package.json frontend-projects/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend-projects/ ./
ARG RH_APP_URL=https://rh.antigoneinterne.agency
ARG PROJECTS_APP_URL=https://project.antigoneinterne.agency
ENV VITE_BASE=/ VITE_API_URL= VITE_APP_KIND=projects VITE_RH_APP_URL=$RH_APP_URL VITE_PROJECTS_APP_URL=$PROJECTS_APP_URL
RUN npm run build

FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/frontend-nginx.conf /etc/nginx/conf.d/apps.conf
COPY --from=build-rh /app/dist /usr/share/nginx/html/rh
COPY --from=build-projects /app/dist /usr/share/nginx/html/projects
EXPOSE 80
