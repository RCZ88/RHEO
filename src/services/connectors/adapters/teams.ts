import { makeStubAdapter } from '../adapter-utils'
import { register } from '../registry'

const teamsAdapter = makeStubAdapter('teams', 'messaging')
register(teamsAdapter)

export { teamsAdapter }
export default teamsAdapter
