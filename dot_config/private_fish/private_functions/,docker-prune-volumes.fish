function ,docker-prune-volumes --description 'Prune Docker data, including volumes'
    _docker_available; or return 0
    command docker system prune -af --volumes
end
