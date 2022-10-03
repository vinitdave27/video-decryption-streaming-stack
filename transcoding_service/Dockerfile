FROM node:14.20-alpine3.15
WORKDIR /usr/app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --quiet --force
COPY . .