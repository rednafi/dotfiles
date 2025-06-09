# Start Cassandra container and open cqlsh
function ,cup
    set container_name cassandra-cup
    set host_port 9043
    set container_port 9042

    set name_filter (string join "" "^/" $container_name "\$")

    if docker ps -q -f name=$name_filter | grep -q .
        echo "Cassandra container '$container_name' is already running."
    else
        echo "Starting Cassandra on port $host_port..."
        docker run -d --rm \
            --name $container_name \
            -e CASSANDRA_USER=cassandra \
            -e CASSANDRA_PASSWORD=cassandra \
            -p $host_port:$container_port \
            bitnami/cassandra:latest

        echo "Waiting for Cassandra to accept CQL connections..."
        while not docker logs $container_name 2>&1 | grep -q "Starting listening for CQL clients"
            sleep 2
        end
    end

    echo "Connecting with cqlsh..."
    docker run -it --rm \
        --network container:$container_name \
        bitnami/cassandra:latest \
        cqlsh 127.0.0.1 $container_port -u cassandra -p cassandra
end

# Stop Cassandra container
function ,cdown
    docker rm -f cassandra-cup
end
