#!/bin/bash
set -e

if [ ! -d "~/.asdf" ]; then
  git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.10.2
  . $HOME/.asdf/asdf.sh
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

SCREENSHOT_DIR="${project_location}/google_play_rollout"

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