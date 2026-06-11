FROM nginx:alpine

LABEL maintainer="Farmexa Platform"
LABEL description="Farmexa ERP frontend"

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q --spider http://127.0.0.1:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
