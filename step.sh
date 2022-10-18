#!/bin/bash
set -ex

SOURCE_DIR=$(pwd)
STEP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd $STEP_DIR

if [ -d ".asdf" ]; then
  git clone https://github.com/asdf-vm/asdf.git .asdf --branch v0.10.2
  . .asdf/asdf.sh
  asdf plugin add nodejs
  asdf install nodejs
fi

npm install

IGNORE_WARN_OPTION=""
if [ "${ignore_warn}" = "yes" ]; then
  IGNORE_WARN_OPTION="-w"
fi

SCREENSHOT_REVIEW=""
if [ "${screenshot_review}" = "yes" ]; then
  SCREENSHOT_REVIEW="-s"
fi

DEBUG=""
if [ "${debug}" = "yes" ]; then
  DEBUG="-D"
fi

SCREENSHOT_DIR="/tmp/google_play_rollout"
if [ ! -d "$SCREENSHOT_DIR" ]; then
  mkdir "$SCREENSHOT_DIR"
fi

GOOGLE_PLAY_SCREENSHOT_PATH=$(node ./src/main.js \
  -i "${account_id}" \
  -a "${app_id}" \
  -t "${track_name}" \
  -e "${user_email}" \
  -p "${password}" \
  ${IGNORE_WARN_OPTION} \
  ${SCREENSHOT_REVIEW} \
  -d "${SCREENSHOT_DIR}" \
  -S "${two_step_verification_secret}" \
  ${DEBUG})

envman add --key GOOGLE_PLAY_SCREENSHOT_PATH --value "$GOOGLE_PLAY_SCREENSHOT_PATH"

cd $SOURCE_DIR
