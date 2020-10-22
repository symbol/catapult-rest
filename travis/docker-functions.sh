#!/usr/bin/env bash
set -e

. ./travis/travis-functions.sh

docker_build(){
  VERSION="$1"
  OPERATION="$2"

  validate_env_variable "DOCKER_IMAGE_NAME" "$FUNCNAME"
  validate_env_variable "VERSION" "$FUNCNAME"

  echo "Creating image ${DOCKER_IMAGE_NAME}:${VERSION}"
  docker build -t "${DOCKER_IMAGE_NAME}:${VERSION}" .

  if [[ "$OPERATION" == "publish" || "$OPERATION" == "release"  ]];
  then
      echo "Building for operation ${OPERATION}..."
      validate_env_variable "DOCKER_USERNAME" "$FUNCNAME"
      validate_env_variable "DOCKER_PASSWORD" "$FUNCNAME"
      echo "Login into docker..."
      echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin

      if [ "$OPERATION" = "publish" ]
      then
          docker tag "${DOCKER_IMAGE_NAME}:${VERSION}" "${DOCKER_IMAGE_NAME}:${VERSION}-alpha"
          docker tag "${DOCKER_IMAGE_NAME}:${VERSION}" "${DOCKER_IMAGE_NAME}:${VERSION}-alpha-$(date +%Y%m%d%H%M)"
          echo "Docker pushing alpha"
          docker push "${DOCKER_IMAGE_NAME}:${VERSION}-alpha"
          docker push "${DOCKER_IMAGE_NAME}:${VERSION}-alpha-$(date +%Y%m%d%H%M)"
      fi

      if [ "$OPERATION" = "release" ]
      then
          docker tag "${DOCKER_IMAGE_NAME}:${VERSION}" "${DOCKER_IMAGE_NAME}:release"
          echo "Docker pushing release"
          docker push "${DOCKER_IMAGE_NAME}:release"
          docker push "${DOCKER_IMAGE_NAME}:${VERSION}"
      fi

  fi
}

if [ "$1" == "docker_build" ];then
    docker_build $2 $3
fi

if [ "$1" == "docker_build_version_file" ];then
    docker_build $(load_version_from_file) $2
fi

