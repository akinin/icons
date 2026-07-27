#!/usr/bin/env bash

set -Eeuo pipefail

repository_root="$(git rev-parse --show-toplevel)"
cd "${repository_root}"

github_repository_url="https://github.com/akinin/icons"
github_raw_url="https://raw.githubusercontent.com/akinin/icons/main"
gitlab_repository_url="https://git.akinin.su/akininav/ahs-icons"
gitlab_raw_url="${gitlab_repository_url}/-/raw/main"
github_image="akininav/icons"
gitlab_image="registry.akinin.su/akininav/ahs-icons"

while IFS= read -r -d '' file; do
  case "${file}" in
    .github/*)
      continue
      ;;
  esac

  if grep -Iq . "${file}"; then
    sed -i \
      -e "s#${github_raw_url}#${gitlab_raw_url}#g" \
      -e "s#${github_repository_url}#${gitlab_repository_url}#g" \
      -e "s#${github_image}#${gitlab_image}#g" \
      -e "s#из Docker Hub#из GitLab Container Registry#g" \
      "${file}"
  fi
done < <(git ls-files -z)

# GitHub Actions belong only to the source repository. GitLab receives its own CI
# configuration from .gitlab-ci.yml.
rm -rf .github
