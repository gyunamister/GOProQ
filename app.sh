#! /bin/sh -

NUM_ARGS="$#"
RUN_COMMAND="$1"
OCEL_MOUNT_PATH="$2"

# https://stackoverflow.com/questions/7522712/how-can-i-check-if-a-command-exists-in-a-shell-script
DOCKER_COMPOSE="docker-compose"
if ! type "$DOCKER_COMPOSE" >> /dev/null; then
    DOCKER_COMPOSE="docker compose"
fi

if [[ $NUM_ARGS -ne 1 && $NUM_ARGS -ne 2 ]]; then
    echo "Please provide an app command and optionally a path to a folder of event logs to mount, e.g.: >> ./app.sh --start ../my_ocels/"
    echo "For more information, e.g. all available commands, see the user manual."
    exit -1
fi

if [[ -n "$OCEL_MOUNT_PATH" ]]; then
    OCEL_MOUNT_PATH=$(realpath "$OCEL_MOUNT_PATH")
    if [[ ! -d "$OCEL_MOUNT_PATH" ]]; then
        echo "$OCEL_MOUNT_PATH is not a valid directory or does not exist."
        exit -1
    fi
fi

case "$RUN_COMMAND" in
    ("--start")
        if [[ -n "$OCEL_MOUNT_PATH" ]]; then
            $DOCKER_COMPOSE build _backend_base && OCEL_MOUNT_PATH="$OCEL_MOUNT_PATH" $DOCKER_COMPOSE -f docker-compose.yml -f docker-compose.mount-ocels.yml -f docker-compose.prod.yml up --build --detach
        else
            $DOCKER_COMPOSE build _backend_base && $DOCKER_COMPOSE -f docker-compose.yml -f docker-compose.prod.yml up --build --detach
        fi
        ;;
    ("--start-dev") 
        $DOCKER_COMPOSE build _backend_base && $DOCKER_COMPOSE -f docker-compose.yml -f docker-compose.dev.yml up --build --detach
        ;;
    ("--stop") 
        $DOCKER_COMPOSE stop
        ;;
    ("--remove")
        $DOCKER_COMPOSE -f docker-compose.yml -f docker-compose.prod.yml down --volumes
        ;;
    (*) 
        echo "Please provide a valid app command, e.g. --start. For more information, e.g. all available commands, see the user manual."
        ;;
esac

exit 0
