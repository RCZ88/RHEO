import { makeStubAdapter } from '../adapter-utils'
import { register } from '../registry'

const lineAdapter = makeStubAdapter('line', 'messaging')
register(lineAdapter)

export { lineAdapter }
export default lineAdapter
