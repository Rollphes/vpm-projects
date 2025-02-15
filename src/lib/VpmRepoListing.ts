import fs from 'fs'

import config from '@/json/config.json'
import { PackageJson, VpmRepos } from '@/types'
import { Release } from '@/types/github'

export class VpmRepoListing {
  private static readonly GITHUB_API_BASE_URL = 'https://api.github.com/repos'
  private static readonly VPM_JSON_WEBSITE_PATH = 'website/vpm.json'
  private vpmData: VpmRepos

  constructor() {
    this.vpmData = config.vpmJsonInit as VpmRepos
  }

  public async createVpmJson(): Promise<void> {
    for (const repo of config.repositories) {
      const [owner, repoName] = repo.split('/')
      const releasesResponse = await fetch(
        `${VpmRepoListing.GITHUB_API_BASE_URL}/${owner}/${repoName}/releases`,
      )
      if (!releasesResponse.ok) {
        throw new Error(
          `Failed to fetch latest release: ${releasesResponse.statusText}`,
        )
      }
      const releases = (await releasesResponse.json()) as Release[]

      for (const release of releases) {
        const packageJsonAsset = release.assets.find(
          (asset) => asset.name === 'package.json',
        )
        if (!packageJsonAsset) {
          throw new Error(
            `package.json not found in the release assets of ${repo}@${release.tag_name}`,
          )
        }

        const packageJsonResponse = await fetch(
          packageJsonAsset.browser_download_url,
        )
        if (!packageJsonResponse.ok) {
          throw new Error(
            `Failed to fetch package.json: ${packageJsonResponse.statusText}`,
          )
        }
        const packageJson = (await packageJsonResponse.json()) as PackageJson

        if (!this.vpmData.packages[packageJson.name]) {
          this.vpmData.packages[packageJson.name] = {
            versions: {},
          }
        }

        const zipAsset = release.assets.find((asset) =>
          /.zip$/.test(asset.name),
        )
        if (!zipAsset) {
          throw new Error(
            `zip not found in the release assets of ${repo}@${release.tag_name}`,
          )
        }

        this.vpmData.packages[packageJson.name].versions[packageJson.version] =
          packageJson
        this.vpmData.packages[packageJson.name].versions[
          packageJson.version
        ].repo = config.vpmJsonInit.url
        this.vpmData.packages[packageJson.name].versions[
          packageJson.version
        ].url = zipAsset.browser_download_url
        console.log(`Adding ${packageJson.name}@${packageJson.version}`)
      }

      fs.writeFileSync(
        VpmRepoListing.VPM_JSON_WEBSITE_PATH,
        JSON.stringify(this.vpmData, null, 2),
      )
    }
  }
}
