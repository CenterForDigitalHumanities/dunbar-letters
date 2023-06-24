import AuthButton from 'https://centerfordigitalhumanities.github.io/DLA/auth.js'
import { default as UTILS } from './deer-utils.js'
const DEV = false // false or comment to turn off
const baseV1 = DEV ? "https://devstore.rerum.io/":"https://store.rerum.io/"
const tiny = DEV ? "https://tinydev.rerum.io/app/":"https://tinypaul.rerum.io/dla/"

export default {
    ID: "deer-id", // attribute, URI for resource to render
    TYPE: "deer-type", // attribute, JSON-LD @type
    TEMPLATE: "deer-template", // attribute, enum for custom template
    KEY: "deer-key", // attribute, key to use for annotation
    LABEL: "title", // attribute, alternate label for properties
    CONTEXT: "deer-context", // attribute, JSON-LD @context, scoped
    ATTRIBUTION: "deer-creator", // attribute, Web Annotation `creator`, scoped
    MOTIVATION: "deer-motivation", // attribute, Web Annotation `motivation`, scoped
    LIST: "deer-list", // attribute, property with resource array
    COLLECTION: "deer-collection", // attribute, name of aggregating collection
    LISTENING: "deer-listening", // attribute, name of container to watch for clicks
    LINK: "deer-link", // attribute, location of href#[deer-id] for <a>s
    VIEW: "deer-view, .deer-view", // selector, identifies render containers
    FORM: "form[deer-type]", // selector, identifies data entry containers
    ITEMTYPE: "deer-item-type", //attribute, specialty forms ('entity' by default)
    SOURCE: "deer-source", // attribute, URI for asserting annotation
    EVIDENCE: "nv-evidence", // attribute, URI for supporting evidence
    INPUTTYPE: "deer-input-type", //attribute, defines whether this is an array list, array set, or object 
    ARRAYDELIMETER: "deer-array-delimeter", //attribute, denotes delimeter to use for array.join()

    INPUTS: ["input", "textarea", "dataset", "select"], // array of selectors, identifies inputs with .value
    CONTAINERS: ["ItemList", "ItemListElement", "List", "Set", "list", "set", "@list", "@set"], // array of supported list and set types the app will dig into for array values
    PRIMITIVES: [],

    URLS: {
        BASE_ID: baseV1,
        CREATE: tiny+"create",
        UPDATE: tiny+"update",
        OVERWRITE: tiny+"overwrite",
        QUERY: tiny+"query",
        DELETE: tiny+"delete",
        SINCE: baseV1+"since"
    },

    EVENTS: {
        CREATED: "deer-created",
        UPDATED: "deer-updated",
        LOADED: "deer-loaded",
        NEW_VIEW: "deer-view",
        NEW_FORM: "deer-form",
        VIEW_RENDERED : "deer-view-rendered",
        FORM_RENDERED : "deer-form-rendered",
        CLICKED: "deer-clicked"
    },

    SUPPRESS: ["__rerum", "@context"], //properties to ignore
    DELIMETERDEFAULT: ",", //Default delimeter for .split()ing and .join()ing 
    ROBUSTFEEDBACK: true, //Show warnings along with errors in the web console.  Set to false to only see errors.  

    /**
     * Add any custom templates here through import or copy paste.
     * Templates added here will overwrite the defaults in deer-render.js.
     * 
     * Each property must be lower-cased and return a template literal
     * or an HTML String.
     */
    TEMPLATES: {
        msList: function (obj, options = {}) {
            let tmpl = `<h2>Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar (${obj?.[options?.list].length ?? " empty "})</h2>`
            if (options.list) {
                tmpl += `<ul>`
                obj[options.list].forEach((val, index) => {
                    tmpl += `<li><a href="${options.link}${val['@id']}"><deer-view deer-id="${val["@id"]}" deer-template="label">${val.label}</deer-view></a></li>`
                })
                tmpl += `</ul>`
            }
            return tmpl
        },
        managedlist: (obj, options = {}) => {
            // Come on, Mr. Hacker. We both know you could break in here, but why waste your time? It is tested on the server past here.
            if(!userHasRole(["dunbar_user_curator","dunbar_user_reviewer","dunbar_user_contributor","dunbar_user_public"])) { return `This function is limited to administrators.`}
            try {
                let tmpl = `<input type="hidden" deer-collection="${options.collection}">`
                if (options.list) {
                    tmpl += `<ul>`
                    obj[options.list].forEach((val, index) => {
                        const removeBtn = `<a href="${val['@id']}" class="removeCollectionItem" title="Delete This Entry">&#x274C</a>`
                        const onlistBtn = `<a class="togglePublic project" href="${val['@id']}" title="Toggle project inclusion"> &plus; </a>`
                        const visibilityBtn = `<a class="togglePublic released" href="${val['@id']}" title="Toggle public visibility"> 👁 </a>`
                        tmpl += `<li>
                        ${onlistBtn}
                        ${visibilityBtn}
                        <a href="${options.link}${val['@id']}">
                            <deer-view deer-id="${val["@id"]}" deer-template="label">${index + 1}</deer-view>
                        </a>
                        ${removeBtn}
                        </li>`
                    })
                    tmpl += `</ul>`
                }
                else {
                    console.log("There are no items in this list to draw.")
                    console.log(obj)
                }
                return {
                    html: tmpl,
                    then: elem => {

                        fetch(elem.getAttribute("deer-listing")).then(r => r.json())
                            .then(list => {
                                elem.projectCache = new Set()
                                list.itemListElement?.forEach(item => elem.projectCache.add(item['@id']))
                                for (const a of document.querySelectorAll('.togglePublic.project')) {
                                    const include = elem.projectCache.has(a.getAttribute("href")) ? "add" : "remove"
                                    a.classList[include]("is-included")
                                }
                            })
                            .then(() => {
                                document.querySelectorAll('.togglePublic.project').forEach(a => a.addEventListener('click', ev => {
                                    ev.preventDefault()
                                    ev.stopPropagation()
                                    const uri = a.getAttribute("href")
                                    const included = elem.projectCache.has(uri)
                                    a.classList[included ? "remove" : "add"]("is-included")
                                    elem.projectCache[included ? "delete" : "add"](uri)
                                    saveList.style.visibility = "visible"
                                }))
                            })

                        fetch(elem.getAttribute("deer-released")).then(r => r.json())
                            .then(list => {
                                elem.listCache = new Set()
                                list.itemListElement?.forEach(item => elem.listCache.add(item['@id']))
                                for (const a of document.querySelectorAll('.togglePublic.released')) {
                                    const include = elem.listCache.has(a.getAttribute("href")) ? "add" : "remove"
                                    a.classList[include]("is-included")
                                }
                            })
                            .then(() => {
                                document.querySelectorAll(".removeCollectionItem").forEach(el => el.addEventListener('click', (ev) => {
                                    ev.preventDefault()
                                    ev.stopPropagation()
                                    const itemID = el.getAttribute("href")
                                    const fromCollection = document.querySelector('input[deer-collection]').getAttribute("deer-collection")
                                    deleteThis(itemID, fromCollection)
                                }))
                                document.querySelectorAll('.togglePublic.released').forEach(a => a.addEventListener('click', ev => {
                                    ev.preventDefault()
                                    ev.stopPropagation()
                                    const uri = a.getAttribute("href")
                                    const included = elem.listCache.has(uri)
                                    a.classList[included ? "remove" : "add"]("is-included")
                                    elem.listCache[included ? "delete" : "add"](uri)
                                    saveList.style.visibility = "visible"
                                }))
                                saveList.addEventListener('click', overwriteList)
                            })

                        function overwriteList() {
                            let mss = []
                            elem.listCache.forEach(uri => {
                                const label = document.querySelector(`deer-view[deer-id='${uri}']`)?.textContent.trim()
                                if(!label) { return }
                                mss.push({
                                    label,
                                    '@id': uri
                                })
                            })
        
                            const list = {
                                '@id': elem.getAttribute("deer-listing"),
                                '@context': 'https://schema.org/',
                                '@type': "ItemList",
                                name: elem.getAttribute("deer-collection") ?? "Dunbar Poems",
                                numberOfItems: elem.listCache.size,
                                itemListElement: mss
                            }
        
                            fetch(`${tiny}overwrite`, {
                                method: "PUT",
                                mode: 'cors',
                                headers: {
                                    "Content-Type": "application/json; charset=utf-8",
                                    "Authorization": `Bearer ${window.DLA_USER.authorization}`
                                },
                                body: JSON.stringify(list)
                            }).then(r => r.ok ? r.json() : Promise.reject(r))
                                .catch(err => alert(`Failed to save: ${err}`))
                        }

                        function deleteThis(id, collection) {
                            alert("The removal of letters is under development")
                            return
                            if (confirm("Really remove this record?\n(Cannot be undone)")) {
                                const queryObj = {
                                    $or: [{
                                        "targetCollection": collection
                                    }, {
                                        "body.targetCollection": collection
                                    }],
                                    target: httpsIdArray(id),
                                    "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] }
                                }
                                fetch(`${tiny}query`, {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json; charset=utf-8"
                                    },
                                    body: JSON.stringify(queryObj)
                                })
                                    .then(r => r.ok ? r.json() : Promise.reject(r))
                                    .then(annos => {
                                        let all = annos.map(anno => {
                                            return fetch(`${tiny}delete`, {
                                                method: "DELETE",
                                                headers: {
                                                    "Content-Type": "application/json; charset=utf-8",
                                                    "Authorization": `Bearer ${window.DLA_USER.authorization}`
                                                },
                                                body: JSON.stringify(anno)
                                            })
                                                .then(r => r.ok ? r.json() : Promise.reject(r))
                                                .catch(err => { throw err })
                                        })
                                        Promise.all(all).then(success => {
                                            document.querySelector(`[deer-id="${id}"]`).closest("li").remove()
                                        })
                                    })
                                    .catch(err => console.error(`Failed to delete: ${err}`))
                            }
                        }

                    }
                }
            } catch (err) {
                console.log("Could not build list template.")
                console.error(err)
                return null
            }
        }
    },
    version: "alpha"
}

/**
 * Checks array of stored roles for any of the roles provided.
 * @param {Array} roles Strings of roles to check.
 * @returns Boolean user has one of these roles.
 */
function userHasRole(roles){
    if (!Array.isArray(roles)) { roles = [roles] }
    try {
        return Boolean(DLA_USER?.["http://dunbar.rerum.io/user_roles"]?.roles.filter(r=>roles.includes(r)).length)
    } catch (err) {
        return false
    }
}

function httpsIdArray(id,justArray) {
    if (!id.startsWith("http")) return justArray ? [ id ] : id
    if (id.startsWith("https://")) return justArray ? [ id, id.replace('https','http') ] : { $in: [ id, id.replace('https','http') ] }
    return justArray ? [ id, id.replace('http','https') ] : { $in: [ id, id.replace('http','https') ] }
}
