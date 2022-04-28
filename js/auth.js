/**
 * @module AuthButton Adds custom element for login/logout of Auth0, based on configuration below.
 * @author cubap
 * 
 * @description This module includes a custom `<button is="auth-button">` element for authentication within 
 * the Dunbar Public Library and Archive Project.
 * Notes: 
 * - Include this module and a button[is='auth-button'] element to use. 
 * - Add the `disabled` property on any page that should be available to the public, but knowing the user may be helpful.
 * - This can be made more generic by passing in the constants and parameterizing {app:'dla'}.
 */

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
const login = () => webAuth.authorize({ authParamsMap: { 'app': 'dla' } })

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
                login()
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
