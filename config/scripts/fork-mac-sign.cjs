// electron-builder `mac.sign` hook for fork builds signed with a self-signed certificate.
//
// Why: Squirrel.Mac only installs an update that satisfies the running app's designated
// requirement. Ad-hoc signatures pin that to the build's cdhash, so no later build can pass;
// a fixed self-signed cert pins it to the cert instead. electron-builder only accepts
// identities `security find-identity -v` reports as trusted, which a self-signed cert is
// not without admin trust settings, so this hook substitutes the identity after its lookup.
const { signAsync } = require('@electron/osx-sign')

module.exports = async function forkMacSign(opts) {
  const identity = process.env.ORCA_FORK_MAC_SIGN_IDENTITY
  if (!identity) {
    throw new Error('ORCA_FORK_MAC_SIGN_IDENTITY is required for fork mac signing')
  }
  await signAsync({ ...opts, identity, identityValidation: false })
}
