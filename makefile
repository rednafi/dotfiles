.PHONY: help
help:		## Show this message and exit
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: install_packages
install_packages: ## Use ansible to install apt packages
	ansible-playbook playbooks/packages.yml --ask-become-pass

.PHONY: install_docker
install_docker: ## Use ansible to install docker & docker-compose
	ansible-playbook playbooks/docker.yml --ask-become-pass
