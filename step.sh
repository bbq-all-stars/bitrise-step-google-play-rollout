#!/bin/bash
set -ex

account_id=${account_id:=""}
app_id=${app_id:=""}
track_name=${track_name:=""}
user_email=${user_email:=""}
password=${password:=""}
ignore_warn=${ignore_warn:=""}
screenshot_review=${screenshot_review:=""}
screenshot_size=${screenshot_size:=""}
totp_secret=${totp_secret:=""}

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
  -c "${screenshot_size}" \
  -S "${totp_secret}")

envman add --key GOOGLE_PLAY_SCREENSHOT_PATH --value "$GOOGLE_PLAY_SCREENSHOT_PATH"

cd "$SOURCE_DIR"