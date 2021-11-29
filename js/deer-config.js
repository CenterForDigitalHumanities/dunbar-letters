const DEV = true

const baseV1 = DEV ? "http://devstore.rerum.io/" : "http://store.rerum.io/"
const tiny = DEV ? "http://tinydev.rerum.io/app/" : "http://tinypaul.rerum.io/dla/"

import { default as UTILS } from './deer-utils.js'
import pLimit from './plimit.js'
const limiter = pLimit(4)
let projects = []

fetch(`http://165.134.105.25:8181/TPEN28/getDunbarProjects`, { cache: "force-cache" })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(list => projects = list)

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
        CREATE: tiny + "create",
        UPDATE: tiny + "update",
        OVERWRITE: tiny + "overwrite",
        QUERY: tiny + "query",
        SINCE: baseV1 + "since"
    },

    EVENTS: {
        CREATED: "deer-created",
        UPDATED: "deer-updated",
        LOADED: "deer-loaded",
        NEW_VIEW: "deer-view",
        NEW_FORM: "deer-form",
        VIEW_RENDERED: "deer-view-rendered",
        FORM_RENDERED: "deer-form-rendered",
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
        cat: (obj) => `<h5>${obj.name}</h5><img src="http://placekitten.com/300/150" style="width:100%;">`,
        msList: function (obj, options = {}) {
            let tmpl = `<h2>Manuscripts</h2>`
            if (options.list) {
                tmpl += `<ul>`
                obj[options.list].forEach((val, index) => {
                    tmpl += `<li><deer-view deer-template="saveTPENlinks" deer-id="${val["@id"]}"> 0 </deer-view><a href="${options.link}${val['@id']}"><deer-view deer-id="${val["@id"]}" deer-template="label"></deer-view></a></li>`
                })
                tmpl += `</ul>`
            }
            return tmpl
        },
        saveTPENlinks: (obj, options = {}) => {

            const DC_ROOT_ANNOTATION = {
                "@context": "http://www.w3.org/ns/anno.jsonld",
                "@type": "Annotation",
                creator: "http://store.rerum.io/v1/id/618d4cfa50c86821e60b2cba",
            }
            const NEW_RECORD = {
                "@context": "https://schema.org/docs/jsonldcontext.json",
                "@type": "Text",
                creator: "http://store.rerum.io/v1/id/618d4cfa50c86821e60b2cba",
            }


            return {
                html: `<button role="button" class="addemup" hndl="${UTILS.getValue(obj.source)}"></button>`,
                then: elem => {
                    if (-1 === elem.querySelector('button')?.getAttribute('hndl')?.indexOf('/')) {
                        console.log("No handle here: ", elem)
                        return
                    }
                    // loadUDelMetadata(elem.querySelector('button')?.getAttribute('hndl'))
                    //     .then(async (metadata) => {
                    //         matchTranscriptionRecords(projects, metadata)
                    //             .then(projList => {
                    //                 elem.setAttribute("tpen-projects", projList)
                    //             })
                    //     })
                    elem.addEventListener('click', findLink)
                    elem.addEventListener('dblclick', saveLink)
                }
            }

            function findLink(event) {
                const elem = event.target
                loadUDelMetadata(elem.getAttribute('hndl'))
                    .then(async (metadata) => {
                        matchTranscriptionRecords(projects, metadata)
                            .then(projList => {
                                elem.setAttribute("tpen-projects", projList)
                            })
                    })
            }

            function saveLink(event) {
                const target = event.target.closest("[deer-id]").getAttribute("deer-id")
                const projectIDs = event.target.getAttribute("tpen-projects")?.split("|")

                projectIDs.forEach((id, index) => {
                    limiter(async () => {
                        let t = index > 0 ? await createNewRecord(target) : target
                        return createCopy(target, t, id)
                    })
                })
            }

            async function createNewRecord(basedOn) {
                let original = await fetch(basedOn).then(r => r.json()).then(entity => {
                    return UTILS.expand(entity).then(expanded => {
                        delete expanded.__rerum
                        delete expanded['@id']
                        delete entity.id
                        return expanded
                    })
                })
                const record = Object.assign({
                    label: original.title
                }, NEW_RECORD)
                return fetch(tiny + "create", {
                    method: 'POST',
                    mode: 'cors',
                    body: JSON.stringify(record)
                })
                    .then(res => res.ok ? res.headers.get("location") ?? res.headers.get("Location") : Promise.reject(res))
                    .catch(err => console.error(err))
            }

            async function createCopy(id, newID, projectID) {
                let original = await fetch(baseV1 + "id/" + id).then(r => r.json()).then(entity => {
                    return UTILS.expand(entity).then(expanded => {
                        delete expanded.__rerum
                        delete expanded['@id']
                        delete expanded.id
                        return expanded
                    })
                })
                const annoMap = id === newID ?
                    {
                        tpenProject: projectID
                    }
                    : {
                        targetCollection: original.targetCollection,
                        date: original.date,
                        identifier: original.identifier,
                        source: original.source,
                        tpenProject: projectID
                    }

                let all = []
                for (const key in annoMap) {
                    all.push(
                        (() => {
                            const anno = Object.assign({
                                target: newID,
                                body: { key: { value: annoMap[key] } }
                            }, DC_ROOT_ANNOTATION)
                            return fetch(tiny + "create", {
                                method: 'POST',
                                mode: 'cors',
                                body: JSON.stringify(anno)
                            }).catch(err => console.error(err))
                        })
                    )
                }
                return Promise.all(all)
            }
        }
    },
    version: "alpha"
}

async function matchTranscriptionRecords(list, metadata) {
    const getFolderFromMetadata = (metaMap) => {
        for (const m of metaMap) {
            if (m.identifier) { return m.identifier }
        }
    }
    const folder = getFolderFromMetadata(metadata).split(" F").pop()// Like "Box 3, F4"
    const matchStr = `F${folder.padStart(3, '0')}`
    let foundMsg = []
    for (const f of list) {
        if (f.collection_code === matchStr) {
            foundMsg.push(f.id)
        }
    }
    return foundMsg.join("|")
}

async function loadUDelMetadata(handle) {
    const historyWildcard = { "$exists": true, "$size": 0 }
    const uDelData = {
        target: handle,
        "__rerum.history.next": historyWildcard
    }
    let results = []
    return getPagedQuery(100)

    function getPagedQuery(lim, it = 0) {
        return fetch(`${tiny}query?limit=${lim}&skip=${it}`, {
            method: "POST",
            mode: "cors",
            body: JSON.stringify(uDelData)
        }).then(response => response.json())
            .then(list => {
                results.push(list)
                if (list.length ?? (list.length % lim === 0)) {
                    return getPagedQuery(lim, it + list.length)
                } else {
                    return getFirstMetadataResult(results)
                }
            })
    }
    function getFirstMetadataResult(annos) {
        if (!Array.isArray(annos)) return annos
        for (const r of annos) {
            const tests = r?.flat().pop().body ?? r.body
            if (tests.length ?? tests.identifier) {
                return tests
            }
        }
    }
}


function getTranscriptionProjects(metadata) {
    // you must log in first, dude
    // fetch(`media/tpen.json`)
    return fetch(`http://165.134.105.25:8181/TPEN28/getDunbarProjects`)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => matchTranscriptionRecords(list, metadata))
}
