function ,docker-prune-containers --description 'Stop and remove all Docker containers'
    _docker_available; or return 0
    set -l containers (command docker ps -aq 2>/dev/null)
    test (count $containers) -gt 0; or return 0

    command docker stop $containers 2>/dev/null; or true
    command docker rm $containers 2>/dev/null; or true
end
