#!/bin/bash
set -ex

if [ -d ".asdf" ]; then
  git clone https://github.com/asdf-vm/asdf.git .asdf --branch v0.10.2
  . .asdf/asdf.sh
  asdf plugin add nodejs
  asdf install nodejs
fi

cd $BITRISE_SOURCE_DIR

npm install

IGNORE_WARN_OPTION=""
if "${ignore_warn}"; then
  IGNORE_WARN_OPTION="-w"
fi

SCREENSHOT_REVIEW=""
if "${screenshot_review}"; then
  SCREENSHOT_REVIEW="-s"
fi

DEBUG=""
if "${debug}"; then
  DEBUG="-D"
fi

SCREENSHOT_DIR="${PWD}/google_play_rollout"
if [ ! -d "$SCREENSHOT_DIR" ]; then
  mkdir "$SCREENSHOT_DIR"
fi

GOOGLE_PLAY_SCREENSHOT_PATH=$(node ./src/main.js \
  -i "${developer_account_id}" \
  -a "${app_id}" \
  -t "${track_name}" \
  -e "${user_email}" \
  -p "${password}" \
  ${IGNORE_WARN_OPTION} \
  ${SCREENSHOT_REVIEW} \
  -d "${SCREENSHOT_DIR}" \
  ${DEBUG})