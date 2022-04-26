import 'https://cdn.auth0.com/js/auth0/9.19.0/auth0.min.js'

const AUDIENCE = "https://cubap.auth0.com/api/v2/"
const ISSUER_BASE_URL = "cubap.auth0.com"
const CLIENT_ID = "z1DuwzGPYKmF7POW9LiAipO5MvKSDERM"
const DOMAIN = "cubap.auth0.com"

const webAuth = new auth0.WebAuth({
    "domain": DOMAIN,
    "clientID": CLIENT_ID,
    "audience": AUDIENCE,
    "scope": "read:roles profile openid email",
    "redirectUri": origin,
    "responseType": "id_token",
    "state": btoa(encodeURIComponent(location.href))
})

webAuth.checkSession({}, (err, result) => {
    localStorage.setItem("recent", location)
    if (err) { webAuth.authorize() }
    const referringPage = decodeURIComponent(atob(result.state))
    if (referringPage !== location.href) { location.href = referringPage }
    localStorage.setItem("userToken", result.idToken)
    window.DLA_USER = result.idTokenPayload
})

// if (confirm("logout?")) {
//     webAuth.logout({returnTo:origin})
// }
