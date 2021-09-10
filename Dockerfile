FROM ubuntu:20.04

ENV NODE_VERSION=12.18.1
ENV NVM_DIR=/usr/local/.nvm

RUN mkdir -p ${NVM_DIR}
RUN apt-get update && apt-get install -y curl

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/:${PATH}"
RUN node --version
RUN npm --version

RUN npm install -g yarn

WORKDIR /app
COPY . /app/catapult-rest
RUN cd catapult-rest && ./yarn_setup.sh
WORKDIR /app/catapult-rest/rest
