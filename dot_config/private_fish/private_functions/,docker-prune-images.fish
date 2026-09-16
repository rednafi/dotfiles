function ,docker-prune-images --description 'Remove all Docker images'
    _docker_available; or return 0
    set -l images (command docker images -q 2>/dev/null)
    test (count $images) -gt 0; or return 0

    command docker rmi --force $images; or true
end
