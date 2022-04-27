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

const logout = () => webAuth.logout({ returnTo: origin })

const getReferringPage = () => {
    try {
        return decodeURIComponent(atob(decodeURIComponent(location.hash.split("state=")[1].split("&")[0])))
    } catch (err) {
        return false
    }
}

class AuthButton extends HTMLButtonElement {
    constructor() {
        super()
        this.onclick = logout
    }

    connectedCallback() {
        webAuth.checkSession({}, (err, result) => {
            if (err) {
                if (this.getAttribute('disabled') !== null) { return }
                webAuth.authorize({ authParamsMap: { 'app': 'dla' } })
            }
            const ref = getReferringPage()
            if (ref && ref !== location.href) { location.href = ref }
            localStorage.setItem("userToken", result.idToken)
            window.DLA_USER = result.idTokenPayload
            this.innerText = `Logout ${DLA_USER.nickname}`
            this.removeAttribute('disabled')
        })
    }
}

customElements.define('auth-button', AuthButton, { extends: 'button' })
