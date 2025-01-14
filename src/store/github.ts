import { VueComponent } from '../schema/generated/types'
import { apolloClient } from '.'
import { defineStore } from 'pinia'
import { gql } from '@apollo/client/core'
import {
  getGraphUrl,
  PovComponent,
  removeAllAndSomeTagsFromHtml,
  removeNodesWithKeywords,
  trimAndRemoveQueryWrap,
} from '../utilities'
// import Sass from 'sass.js/dist/sass.sync.js'
import { useCreatorState } from './creator'
import { watch } from 'vue'

export const getInitialGithubState = (): {
  code: any
  componentFromCodeState: any
  credentials: { creatorToken?: string; githubToken?: string }
  vuesFetched: boolean
  vues: Array<VueComponent>
  vueComponents: Array<PovComponent>
  account: any
} => ({
  account: null,
  code: {},
  componentFromCodeState: null,
  credentials: {},
  vues: [],
  vueComponents: [],
  vuesFetched: false,
})

export const useGithubState = defineStore({
  id: 'useGithubState',
  state: getInitialGithubState,
  getters: {
    vuesHaveBeenFetched: (s) => s.vuesFetched,
    getAccount: (s) => s.account,
    getVues: (s) => s.vues,
    getCodeState: (s) => s.code,
    getComponentFromCodeState: (s) => s.componentFromCodeState,
    getVueComponents: (s) => s.vueComponents,
  },
  actions: {
    setCodeState(newState: any) {
      console.info('setting new code state', newState)
      this.code = newState
      this.setComponentFromCodeState(this.code)
    },

    setComponentFromCodeState(code: any) {
      const updatedComponentValues = code.json?.length ? JSON.parse(code.json) : {}
      this.componentFromCodeState = {
        name: updatedComponentValues.name,
        background: updatedComponentValues.background,
        icon: updatedComponentValues.icon,
        status: 'good', /// TODO: calculate this,
        category: updatedComponentValues.category,
        description: updatedComponentValues.description,
        vue: code.json ?? '',
        template: code.html ?? '',
        script: code.javascript ?? '',
        query: code.graphql ?? '',
      }
      console.info('parsing code into component', code, this.componentFromCodeState)
    },

    getVueComponent(oid: string): PovComponent | undefined {
      return this.vueComponents.find((c: PovComponent) => c.oid === oid)
    },

    hasCredentials() {
      if (this.credentials?.creatorToken?.length && this.credentials?.githubToken?.length) {
        return true
      }

      const creatorState = useCreatorState()
      const credentials = creatorState.getCreatorCredentials

      if (credentials.creatorToken && credentials.github) {
        this.credentials = {
          creatorToken: credentials.creatorToken,
          githubToken: credentials.github,
        }
        return true
      } else {
        return false
      }
    },

    async compileComponent(
      payload: any
    ): Promise<{ output: string; logs: { errors: string[]; info: string[] } }> {
      let dataRequest
      let info: string[] = []
      let errors: string[] = []
      let normalizedHTML = ''
      let normalizedJS = ''
      let stringifiedData = '{}'
      let normalizedJson = '{}'

      if (payload.query.trim().length) {
        /// check for bad stuff here
        const query = trimAndRemoveQueryWrap(payload.query)
        const options = {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.credentials.creatorToken}`,
          },
          body: JSON.stringify({
            query: `query {${query}}`,
          }),
        }

        dataRequest = await fetch(getGraphUrl(), options)
          .then((res) => res.json())
          .catch((err) => {
            // this.logs.error(err)
            console.error('data fetch error', { err })
            errors.push(err.message)
          })

        if (!dataRequest || dataRequest?.errors) {
          errors = errors.concat(
            dataRequest.errors.reduce(
              (o: string[], v: any) => {
                o.push(`line ${v.locations[0].line}:${v.locations[0].column} -- ${v.message}`)
                return o
              },
              ['query errors']
            )
          )
        } else {
          stringifiedData = JSON.stringify(dataRequest?.data ?? {})
        }
      }

      if (!errors.length) {
        const htmlNormalized = removeAllAndSomeTagsFromHtml(
          payload.template,
          ['head', 'link', 'script', 'style'],
          ['body', 'html']
        )
        const jsNormalized = removeNodesWithKeywords(payload.script, [
          'window',
          'alert',
          'import',
          'fetch',
          'require',
          'console.log',
        ])

        const htmlLinesWereRemoved = htmlNormalized.removed.length
        const jsLinesWereRemoved = jsNormalized.removed.length
        if (jsLinesWereRemoved || htmlLinesWereRemoved) {
          info.push('Lines with the following keywords were removed during compilation')

          if (htmlLinesWereRemoved) {
            info = info.concat([' template ', ...htmlNormalized.removed])
          }
          if (jsLinesWereRemoved) {
            info = info.concat([' script ', ...jsNormalized.removed])
          }
        }

        normalizedHTML = htmlNormalized.output
        normalizedJS = jsNormalized.output
        /// TODO: check this payload value
        normalizedJson = payload.vue?.length ?? '{}'
      }
      /// Add tailwind
      // console.log({ Sass })
      // let css = ''
      // Sass.preloadFiles('://', 'styles', ['tailwind.css'])
      // await Sass.compile(
      //   `
      // @tailwind base;
      // @tailwind components;
      // @tailwind utilities;`,
      //   (s) => {
      //     console.log({ s })
      //     return (css = s)
      //   }
      // )
      // console.log({ css })

      return {
        output: `
        <template>
          <div class="flex justify-center">
            <div class="block p-6 rounded-lg shadow-lg bg-white max-w-sm">
              ${normalizedHTML}
            </div>
          </div>
        </template>
        <style scoped>
          @tailwind base;
          @tailwind components;
          @tailwind utilities;
        </style>
        <script setup>
          /// Auto Import
          import { onMounted, ref, computed } from 'vue'
          import { useMotion } from '@vueuse/motion'

          /// Hydration
          const query = ${stringifiedData}
          const vue = ${normalizedJson}
          
          /// Script
          ${normalizedJS}

          // onMounted(() => {
            // console.log('window.tailwindCSS', window.tailwindCSS)
            // window.tailwindCSS.refresh()
          // })
        </script>`,
        /// Feature disabled
        //   <style scoped>
        //     ${payload.css}
        //   </style>
        // `
        logs: {
          info,
          errors,
        },
      }
    },

    compileComponentHTML(payload: Record<string, any>, isDark?: boolean) {
      return `<html class="${isDark ? 'dark' : ''}">
        <head>
            <style id="_style">${payload.css}</style>
            <script type="module" id="_script">
                ${payload.script}
                window.addEventListener('message', function(event) {
                    console.log(event)
                    if (event.data === 'theme-dark') {
                        document.documentElement.classList.add('dark')
                    } else if (event.data === 'theme-light') {
                        document.documentElement.classList.remove('dark')
                    }
                })
            </script>
            <script>
              
              const options = {
                method: "post",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": \`Bearer ${this.credentials.creatorToken}\`
                },
                body: JSON.stringify({
                  query: \`${payload.query}\`
                })
              };
          
              fetch('${getGraphUrl()}', options)
                .then(res => res.json())
                .then((d) => {
                  console.log({d})
                  /// Call Render Method
                  document.getElementById('data').innerText = JSON.stringify(d?.data, null, 2)
                });
            </script>
        </head>
        <body>
            <div id="_html">
              ${payload.template}
            </div>
            <div>
              <h1>DATA</h1>
              <pre id="data"></pre>
            </div>
        </body>
    </html`
    },

    async fetchVues(oid?: string) {
      if (this.vuesFetched) {
        return Promise.resolve(this.vues)
      } else if (!this.credentials.githubToken?.length) {
        return Promise.resolve([])
      }

      const fetchVuesForCreatorQuery = gql`
        query StoreFetchGithub_Vues($token: String!, $oid: String) {
          github_vues(from: { token: $token }, where: { oid: $oid }) {
            oid
            name
            query
            script
            template
            vue
          }
        }
      `
      const { data, error: queryError } = await apolloClient.query({
        query: fetchVuesForCreatorQuery,
        variables: { token: this.credentials.githubToken, oid },
      })
      if (data?.github_vues?.length && !queryError) {
        this.vuesFetched = true
        this.vues = data.github_vues
        this.vueComponents = this.vues.map((v) => {
          const vueComponentJson = JSON.parse(v.vue ?? '{}')
          return {
            oid: v.oid,
            name: vueComponentJson.name ?? v.name ?? '',
            vue: v.vue,
            script: v.script,
            template: v.template,
            status: 'good', /// TODO: calculate this
            query: v.query,
          } as PovComponent
        })
      } else if (queryError) {
        console.error(queryError)
      }
    },

    async fetchAccount() {
      if (this.account) {
        return Promise.resolve(this.account)
      } else if (!this.hasCredentials()) {
        const creatorState = useCreatorState()
        watch(creatorState, (c) => {
          if (c.isLoggedIn) {
            this.fetchAccount()
          }
        })
      }

      const fetchGithubAccountForCreatorQuery = gql`
        query StoreFetchGithubAccount($token: String!) {
          github_account(from: { token: $token }) {
            id
            databaseId
            email
            name
            avatar
            website
            bio
            city
            country
            timezone
            profile
            company
            location
            url
            status
            sponsorsListing
            isBountyHunter
            isCampusExpert
            isDeveloperProgramMember
            isEmployee
            isFollowingViewer
            isHireable
            isGitHubStar
            isSiteAdmin
            followers
            following
            packages
            repositories
            repositoriesContributedTo
            sponsors
            sponsoring
            starredRepositories
          }
        }
      `
      const { data, error: queryError } = await apolloClient.query({
        query: fetchGithubAccountForCreatorQuery,
        variables: { token: this.credentials.githubToken },
      })
      if (data?.github_account && !queryError) {
        this.account = data.github_account
      } else if (queryError) {
        console.error(queryError)
      }
    },
  },
})
