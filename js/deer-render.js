/**
 * @module DeerRender Data Encoding and Exhibition for RERUM
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>
 * @version 0.11
 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

import { default as UTILS } from './deer-utils.js'
import { default as config } from './deer-config.js'
import { OpenSeadragon } from './openseadragon.js'

const changeLoader = new MutationObserver(renderChange)
var DEER = config

/**
 * Observer callback for rendering newly loaded objects. Checks the
 * mutationsList for "deep-object" attribute changes.
 * @param {Array} mutationsList of MutationRecord objects
 */
async function renderChange(mutationsList) {
    for (var mutation of mutationsList) {
        switch (mutation.attributeName) {
            case DEER.ID:
            case DEER.KEY:
            case DEER.LINK:
            case DEER.LIST:
                let id = mutation.target.getAttribute(DEER.ID)
                if (id === "null" || mutation.target.getAttribute(DEER.COLLECTION)) return
                let obj = {}
                try {
                    obj = JSON.parse(localStorage.getItem(id))
                } catch (err) { }
                if (!obj || !obj["@id"]) {
                    obj = await fetch(id).then(response => response.json()).catch(error => error)
                    if (obj) {
                        localStorage.setItem(obj["@id"] || obj.id, JSON.stringify(obj))
                    } else {
                        return false
                    }
                }
                RENDER.element(mutation.target, obj)
                break
            case DEER.LISTENING:
                let listensTo = mutation.target.getAttribute(DEER.LISTENING)
                if (listensTo) {
                    mutation.target.addEventListener(DEER.EVENTS.CLICKED, e => {
                        let loadId = e.detail["@id"]
                        if (loadId === listensTo) { mutation.target.setAttribute("deer-id", loadId) }
                    })
                }
        }
    }
}

const RENDER = {}

RENDER.element = function (elem, obj) {

    return UTILS.expand(obj).then(obj => {
        let tmplName = elem.getAttribute(DEER.TEMPLATE) || (elem.getAttribute(DEER.COLLECTION) ? "list" : "json")
        let template = DEER.TEMPLATES[tmplName] || DEER.TEMPLATES.json
        let options = {
            list: elem.getAttribute(DEER.LIST),
            link: elem.getAttribute(DEER.LINK),
            collection: elem.getAttribute(DEER.COLLECTION),
            key: elem.getAttribute(DEER.KEY),
            label: elem.getAttribute(DEER.LABEL),
            index: elem.getAttribute("deer-index"),
            config: DEER
        }
        let templateResponse = template(obj, options)
        elem.innerHTML = (typeof templateResponse.html === "string") ? templateResponse.html : templateResponse
        //innerHTML may need a little time to finish to actually populate the template to the DOM, so do the timeout trick here.
        /**
         * A streamlined approach would treat each of these as a Promise-like node and the return of RENDER.element
         * would be a Promise.  That way, something that looped and did may of these could do something like
         * Promise.all() before firing a completion/failure event (or something).  
         */
        setTimeout(function () {
            let newViews = (elem.querySelectorAll(config.VIEW).length) ? elem.querySelectorAll(config.VIEW) : []
            let newForms = (elem.querySelectorAll(config.FORM).length) ? elem.querySelectorAll(config.VIEW) : []
            if (newForms.length) {
                UTILS.broadcast(undefined, DEER.EVENTS.NEW_FORM, elem, { set: newForms })
            }
            if (newViews.length) {
                UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, elem, { set: newViews })
            }
            UTILS.broadcast(undefined, DEER.EVENTS.VIEW_RENDERED, elem, obj)
        }, 0)

        if (typeof templateResponse.then === "function") { templateResponse.then(elem, obj, options) }
        //Note this is deprecated for the "deer-view-rendered" event.  above.  
        UTILS.broadcast(undefined, DEER.EVENTS.LOADED, elem, obj)
    })
}

/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json to be drawn as JSON
 * @param {Object} options additional properties to draw with the JSON
 */
DEER.TEMPLATES.json = function (obj, options = {}) {
    let indent = options.indent || 4
    let replacer = (k, v) => {
        if (DEER.SUPPRESS.indexOf(k) !== -1) return
        return v
    }
    try {
        return `<pre>${JSON.stringify(obj, replacer, indent)}</pre>`
    } catch (err) {
        return null
    }
}

/**
 * Get a certain property from an object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj containing a key that needs to be drawn
 * @param {String} key the name of the key in the obj we are looking for
 * @param {String} label The label to be displayed when drawn
 */
DEER.TEMPLATES.prop = function (obj, options = {}) {
    let key = options.key || "@id"
    let prop = obj[key] || "[ undefined ]"
    let label = options.label || UTILS.getLabel(obj, prop)
    try {
        return `<span class="${prop}">${label}: ${UTILS.getValue(prop) || "[ undefined ]"}</span>`
    } catch (err) {
        return null
    }
}

/**
 * Retreive the best label for object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.label = function (obj, options = {}) {
    let key = options.key || "@id"
    let prop = obj[key] || "[ undefined ]"
    let label = options.label || UTILS.getLabel(obj, prop)
    try {
        return `${label}`
    } catch (err) {
        return null
    }
}

/**
 * Retreive the best label for object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.linky = function (obj, options = {}) {
    try {
        let link = obj[options.key]
        return link ? `<a href="${UTILS.getValue(link)}" title="Open in a new window" target="_blank"></a>` : ``
    } catch (err) {
        return null
    }
}

DEER.TEMPLATES.thumbs = function (obj, options = {}) {
    return {
        html: obj.tpenProject ? `<div class="is-full-width"> <h3> ... loading images ... </h3> </div>` : ``,
        then: (elem) => {
            try {
                const proj = obj.tpenProject?.value ?? obj.tpenProject?.pop()?.value ?? obj.tpenProject?.pop() ?? obj.tpenProject
                if (!proj) { return }
                fetch("http://t-pen.org/TPEN/manifest/" + proj)
                    .then(response => response.json())
                    .then(ms => elem.innerHTML = `
                    ${ms.sequences[0].canvases.slice(0, 10).reduce((a, b) => a += `<img class="thumbnail" src="${b.images[0].resource['@id']}">`, ``)}
            `)
            } catch {
                console.log(`No images loaded for transcription project: ${obj.tpenProject?.value}`)
            }
        }
    }
}

DEER.TEMPLATES.pageLinks = function (obj, options = {}) {
    return obj.sequences[0].canvases.reduce((a, b, i) => a += `<a class="button" href="?page=${i + 1}#${obj["@id"]}">${b.label}</a>`, ``)
}

DEER.TEMPLATES.shadow = (obj, options = {}) => {
    return {
        html: `loading external data...`,
        then: (elem) => {
            UTILS.findByTargetId(options.link)
                .then(extData => {
                    const props = extData?.pop().body
                    const entries = props.reduce((a, b) => a += `<label class="col-3" style="font-variant:small-caps;font-weight:bold;">${Object.keys(b)[0]}:</label> <span class="col-9">${UTILS.getValue(Object.values(b)[0], "label")}</span>`, ``)
                    elem.innerHTML = `<div class="card row">
                    <h3 class="is-full-width">Remote Metadata Records</h3>
                    ${entries}
                    </div>`
                })
                .catch(err => elem.innerHTML = "Error loading external data.")
        }
    }
}

DEER.TEMPLATES.recordStatuses = (obj, options = {}) => {
    if (!obj['@id']) { return null }
    return {
        html: `loading statuses`,
        then: async (elem) => {
            let rejected = false
            let reviewed = false

            function makeReadOnly(){
                document.querySelectorAll("input[deer-key]").forEach(el => {
                    el.setAttribute("readonly", "")
                })
                document.querySelectorAll("textarea[deer-key]").forEach(el => {
                    el.setAttribute("readonly", "")
                })
                document.querySelectorAll("input[type='submit']").forEach(el => {
                    el.remove()
                })
                document.querySelectorAll(".dropFrom").forEach(el => {
                    el.remove()
                })
            }

            function addRecordToManagedList(obj, el, coll){
                //PARANOID CHECK to see if it is already in there
                if(coll.itemListElement.filter(record => record["@id"] === obj["@id"]).length === 0){
                    return
                }
                coll.itemListElement.push({"label": obj.label.value, "@id":obj["@id"]})
                coll.numberOfItems++
                fetch(DEER.URLS.OVERWRITE, {
                    method: "PUT",
                    mode: 'cors',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${DLA_USER.authorization}`
                    },
                    body: JSON.stringify(coll)
                })
                .then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
                .then(data => {
                    el.innerHTML = `✔ submitted`
                    el.classList.remove("button")
                    el.classList.remove("bg-error")
                    el.classList.add("bg-success")
                    el.addEventListener("click", e => {
                        return
                    })
                })
                .catch(err => alert(`Failed to save: ${err}`))    
            }  

            let statusArea = document.createElement("DIV")
            let statusAreaHeading = document.createElement("h6")
            statusAreaHeading.innerHTML = "Record Statuses"
            statusArea.classList.add("card", "bg-light")
            //Check if the public collection contains this record id
            const published = await fetch("http://store.rerum.io/v1/id/61ae694e50c86821e60b5d15")
            .then(response => response.json())
            .then(coll => {
                //If you want to know who placed it, you have to check the author of the moderating Annotation
                if(coll.itemListElement.filter(record => record["@id"] === obj['@id']).length){
                    statusArea.innerHTML += `<div title="This record is available publicly" class="recordStatus tag is-small bg-success"> ✔ public </div>`
                    return true
                }
                else{
                    //statusArea.innerHTML += `<div title="This record is not available to the public" class="recordStatus tag is-small bg-error"> ❌ public </div>`
                    return false
                }
            })
            .catch(err => { })

            if(published){
                elem.innerHTML = ""
                statusAreaHeading.innerHTML = `This record is public.  You can not make edits.`
                statusArea.prepend(statusAreaHeading)
                elem.appendChild(statusArea)
                makeReadOnly()
                return
            }

            //Check the moderating Annotation body.releasedTo
            // This Annotation is continually overwritten, so no history wildcard necessary.
            const reviewedQuery =
            {
                "motivation" : "moderating",
                "target": obj["@id"]
            }
            const accepted = await fetch(DEER.URLS.QUERY, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(reviewedQuery)
            })
            .then(response => response.json())
            .then(data => {
                if(data.length){
                    elem.setAttribute(DEER.SOURCE, data[0]['@id'])
                    rejected = (!data[0].body.releasedTo && data[0].body.resultComment) ? true : false
                    if(data[0].body.releasedTo ? true : false){
                        statusArea.innerHTML += `<div class="recordStatus tag is-small bg-success" title="The submission was accepted">✔ accepted</div>`
                    }
                    //reviewed = accepted || rejected
                    // if(reviewed){
                    //     statusArea.innerHTML += 
                    //     `<div class="recordStatus tag is-small ${rejected ? "bg-error" : "bg-success"}"
                    //      title="${rejected ? `The submission was rejected` : `The submission was reviewed`}"> 
                    //      ${rejected ? `❌ rejected` : `✔ reviewed`} </div>`
                    // }
                    // if(rejected){
                    //     statusArea.innerHTML += `
                    //     <div class="recordStatus tag is-small bg-error" title="The submission was rejected">❌ rejected.  See comment.</div>`
                    // }
                }
                return data[0].body.releasedTo ? true : false
            })
            .catch(err => { return false })

            if(accepted){
                // Reviewed and approved.  Should we hide the submit button here too? -- Yes
                statusAreaHeading.innerHTML = `The record was reviewed and accepted.  You can not make edits.`
                statusArea.prepend(statusAreaHeading)
                elem.innerHTML = ""
                elem.innerHTML.appendChild(statusArea)
                makeReadOnly()
                return 
            }

            //Check if the managed collection contains this record id
            const managed = await fetch("http://store.rerum.io/v1/id/61ae693050c86821e60b5d13")
            .then(response => response.json())
            .then(coll => {
                if(coll.itemListElement.filter(record => record["@id"] === obj['@id']).length){
                    statusAreaHeading.innerHTML = `This record has been submitted for review.  You may still make edits below.`
                    statusArea.prepend(statusAreaHeading)
                    statusArea.innerHTML += `<div title="This record has already been submitted" class="recordStatus tag is-small bg-success"> ✔ submitted </div>`
                    return true
                }
                else{
                    let f = document.createElement("FOOTER")
                    f.classList.add("is-right")
                    let d = document.createElement("DIV")
                    d.classList.add("recordStatus", "dark", "button")
                    d.setAttribute("title", "Submit this record for moderation by the reviewers")
                    d.innerHTML = `submit to reviewers ❕ `
                    d.addEventListener("click", e => {
                        if(!userHasRole(["dunbar_user_curator","dunbar_user_contributor","dunbar_user_reviewer"])) { return alert(`This function is limited to contributors, reviewers, and curators.`)}
                        let proceed = confirm("This action is connected with you username.  Click OK to proceed and add your note.")
                        if(!proceed){return}
                        addRecordToManagedList(obj, d, coll)
                    })
                    f.appendChild(d)
                    statusAreaHeading.innerHTML = `Please fill out the information below and submit this record to reviewers.`
                    statusArea.prepend(statusAreaHeading)
                    statusArea.appendChild(f)
                    return false
                }
            })
            .catch(err => { return false })
            if(rejected){
                statusAreaHeading.innerHTML = `The record was rejected.  Please edit the information below and re-submit.`
                statusArea.prepend(statusAreaHeading)
                statusArea.innerHTML += `<deer-view title="The submission was rejected and a comment was left by a reviewer" id="statusComment" class="tag text-center bg-grey text-white is-hidden" deer-template="statusComment" deer-id="${obj["@id"]}"> </deer-view>`
            }
            elem.innerHTML = ""
            elem.appendChild(statusArea)
            if(rejected){
                //So that the status comment comes in
                setTimeout(() => UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, document, elem.querySelector(DEER.VIEW)), 0)
            }
        }
    }
}

DEER.TEMPLATES.statusComment = (obj, options = {}) => {
    if (!obj['@id']) { return null }
    //We know who made the comment in obj.comment.value.author
    let commentElem = 
    `<div style="text-transform: none;" title="${obj.comment.value.text}" > 
        <span> ❌ rejected.  See comment from <deer-view deer-template="label" deer-id="${obj.comment.value.author}">  </deer-view></span>
        <div class="statusDrawer text-dark is-hidden">           
            <pre>${obj.comment.value.text}</pre>
        </div>
     </div>   `

    return {
        html: commentElem,
        then: (elem) => {
            if(obj.comment.value.text){
                elem.classList.remove("is-hidden")
            }
            elem.setAttribute(DEER.SOURCE, obj.comment.source.citationSource)
            elem.addEventListener("click", e => {
                if(e.target.tagName === "PRE"){
                    //This way they can highlight and select text
                    return
                }
                if(elem.querySelector(".statusDrawer").classList.contains("is-hidden")){
                    elem.querySelector(".statusDrawer").classList.remove("is-hidden")
                }
                else{
                    elem.querySelector(".statusDrawer").classList.add("is-hidden")
                }
            })
            //So that the label template draws
            setTimeout(() => UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, document, elem.querySelector(DEER.VIEW)), 0)
        }
    }
}

DEER.TEMPLATES.reviewedStatus = (obj, options = {}) => {
    if (!obj['@id']) { return null }
    // This Annotation is continually overwritten, so no history wildcard necessary.
    const query =
    {
        "motivation" : "moderating",
        "body.releasedTo" : "http://store.rerum.io/v1/id/61ae693050c86821e60b5d13",
        "target": obj["@id"]
    }
    return {
        html: `looking up review status... `,
        then: (elem) => {
            fetch(DEER.URLS.QUERY, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            })
            .then(response => response.json())
            .then(data => {
                if(data.length){
                    elem.setAttribute(DEER.SOURCE, data[0]['@id'])
                    if(data[0].body.releasedTo){
                        elem.innerHTML = `✔ reviewed`
                        // managedStatus.classList.add("is-hidden")
                        // reviewedStatus.classList.add("is-hidden")
                        elem.classList.remove("bg-error")
                        elem.classList.add("bg-success")
                    }
                    else{
                        elem.innerHTML = `❌ reviewed`
                    }
                }
                else{
                    elem.innerHTML = `❌ reviewed`
                }
            })
            .catch(err => { })
        }
    }
}

DEER.TEMPLATES.publishedStatus = (obj, options = {}) => {
    if (!obj['@id']) { return null }

    return {
        html: `looking up record info... `,
        then: (elem) => {
            fetch("http://store.rerum.io/v1/id/61ae694e50c86821e60b5d15")
            .then(response => response.json())
            .then(coll => {
                //If you want to know who placed it, you have to check the author of the moderating Annotation
                if(coll.itemListElement.filter(record => record["@id"] === obj['@id']).length){
                    elem.innerHTML = `✔ This Record is Publicly Available`
                    // managedStatus.classList.add("is-hidden")
                    // reviewedStatus.classList.add("is-hidden")
                    elem.classList.remove("bg-error")
                    elem.classList.add("bg-success")
                }
                else{
                    elem.innerHTML = `❌ This Record is Not Publicly Available`
                }
            })
            .catch(err => { })
        }
    }
}

DEER.TEMPLATES.managedStatus = (obj, options = {}) => {
    if (!obj['@id']) { return null }

    return {
        html: `looking up record info... `,
        then: (elem) => {
            fetch("http://store.rerum.io/v1/id/61ae693050c86821e60b5d13")
            .then(response => response.json())
            .then(coll => {
                //If you want to know who placed it, you have to check the __rerum.creator on the comment Annotation
                //Should we allow Reviewers/Curators to remove it while they are here?
                if(coll.itemListElement.filter(record => record["@id"] === obj['@id']).length){
                    elem.innerHTML = `✔ Submitted For Review`
                    elem.classList.remove("bg-error")
                    elem.classList.add("bg-success")
                }
                else{
                    let drawer = `
                        <div class="statusDrawer is-hidden"> 
                            <div style="margin-top: 1em;"> 
                                <p> This will alert reviewers to look at this item.  You may add a comment below. </p>
                                <textarea class="statusCommentText" style="margin-top: 1em;"></textarea>
                                <input class="notifyReviewerBtn success" type="button" value="Notify Reviewers" style="margin-top: 1em;" />
                            </div>
                        </div>
                    `
                    elem.innerHTML = `Submit For Review ❕ ${drawer}`

                    elem.addEventListener("click", e => {
                        if(e.target.id !== "managedStatus"){
                            //Do not close when users click on internal items
                            return
                        }
                        if(elem.querySelector(".statusDrawer").classList.contains("is-hidden")){
                            elem.querySelector(".statusDrawer").classList.remove("is-hidden")
                        }
                        else{
                            elem.querySelector(".statusDrawer").classList.add("is-hidden")
                        }
                    })

                    elem.querySelector(".notifyReviewerBtn").addEventListener("click", e => {
                        if(!userHasRole(["dunbar_user_curator","dunbar_user_contributor","dunbar_user_reviewer"])) { return alert(`This function is limited to contributors, reviewers, and curators.`)}
                        let proceed = confirm("This action is connected with you username.  Click OK to proceed and add your note.")
                        if(!proceed){return}
                        let url = DEER.URLS.CREATE
                        let method = "POST"
                        const commentAnno = {
                            "@context": "http://purl.org/dc/terms",
                            "motivation" : "commenting",
                            "type": "Annotation",
                            "body":{
                                "comment":{
                                    "type" : "Comment",
                                    "text" : elem.querySelector("textarea").value,
                                    "author" : DLA_USER["http://store.rerum.io/agent"]
                                }
                            },
                            "target":obj["@id"]
                        }
                        if(obj?.comment.source.citationSource){
                            url = DEER.URLS.UPDATE
                            method = "PUT"
                            commentAnno["@id"] = obj.comment.source.citationSource
                        }
                        fetch(url, {
                            method: method,
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${DLA_USER.authorization}`
                            },
                            body: JSON.stringify(commentAnno)
                        })
                        .then(response => response.json())
                        .then(anno => {
                            statusComment.querySelector("span").innerHTML = "See your status comment"
                            statusComment.querySelector("pre").innerHTML = elem.querySelector("textarea").value
                            addRecordToManagedList(obj, elem, coll)
                        })
                        .catch(err => { })
                        
                    })

                    elem.querySelector(".statusCommentText").addEventListener("keydown", e => {
                        if( e.keyCode === 27 ) {
                            e.target.value = ""
                            document.getElementById("managedStatus").click()
                        }
                    })
                }
            })
            .catch(err => { })

            function addRecordToManagedList(obj, elem, coll){
                //PARANOID CHECK to see if it is already in there
                if(coll.itemListElement.filter(record => record["@id"] === obj["@id"]).length === 0){
                    coll.itemListElement.push({"label": obj.label.value, "@id":obj["@id"]})
                    coll.numberOfItems++
                    fetch(DEER.URLS.OVERWRITE, {
                        method: "PUT",
                        mode: 'cors',
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${DLA_USER.authorization}`
                        },
                        body: JSON.stringify(coll)
                    })
                    .then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
                    .then(data => {
                        elem.innerHTML = `✔ Submitted For Review`
                        // managedStatus.classList.add("is-hidden")
                        // publicStatus.classList.add("is-hidden")
                        //statusComment.settAttribute("deer-id", "")
                        //statusComment.settAttribute("deer-id", obj["@id"])
                        elem.classList.remove("bg-error")
                        elem.classList.add("bg-success")
                    })
                    .catch(err => alert(`Failed to save: ${err}`))    
                }
            }    
                
            function removeRecordFromManagedList(obj){
                 fetch("http://store.rerum.io/v1/id/61ae693050c86821e60b5d13")
                .then(response => response.json())
                .then(coll => {
                    coll.itemListElement = coll.itemListElement.filter(record => record["@id"] !== obj['@id'])
                    coll.numberOfItems--
                    fetch(DEER.URLS.OVERWRITE, {
                        method: "PUT",
                        mode: 'cors',
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${DLA_USER.authorization}`
                        },
                        body: JSON.stringify(list_project)
                    })
                    .then(r => r.ok ? r.json() : Promise.reject(Error(r.text)))
                    .catch(err => alert(`Failed to save: ${err}`))
                })
                .catch(err => alert(`Failed to save: ${err}`))
            }  
        }
    }
}

DEER.TEMPLATES.transcriptionStatus = function (obj, options = {}) {
    if (!obj['@id']) { return null }

    return {
        html: `
        looking up transcription status... `,
        then: (elem) => {
            const query = {
                target: obj['@id'],
                "body.transcriptionStatus": { $exists: true }
            }
            fetch(DEER.URLS.QUERY, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            }).then(response => response.json())
                .then(data => {
                    elem.dataset.transcriptionStatus = data[0]?.body.transcriptionStatus ?? "in progress"
                    elem.innerHTML = elem.dataset.transcriptionStatus !== "in progress"
                        ? `✔ Reviewed by <deer-view deer-id="${data[0].body.transcriptionStatus}" deer-template="label">${data[0].body.transcriptionStatus}</deer-view>`
                        : `❌ Not yet reviewed (click to approve)`
                    if(elem.dataset.transcriptionStatus !== "in progress"){
                        elem.classList.remove("bg-error")
                        elem.classList.add("bg-success")
                    }
                    if (data.length) {
                        elem.setAttribute(DEER.SOURCE, data[0]['@id'])
                    }
                    elem.classList[elem.dataset.transcriptionStatus !== "in progress" ? "add" : "remove"]("success")
                    setTimeout(() => UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, document, elem.querySelector(DEER.VIEW)), 0)
                    return
                }).catch(err => { })
            elem.addEventListener("click", e => {
                let url = DEER.URLS.CREATE
                let method = "POST"
                let approval = {
                    target: obj['@id'],
                    body: {
                        transcriptionStatus: (elem.dataset.transcriptionStatus !== "in progress" ? "in progress" : DLA_USER["http://store.rerum.io/agent"])
                    }
                }
                const source = elem.getAttribute(DEER.SOURCE)
                if (source) {
                    approval["@id"] = source
                    url = DEER.URLS.OVERWRITE
                    method = "PUT"
                }
                fetch(url, {
                    method,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${DLA_USER.authorization}`
                    },
                    body: JSON.stringify(approval)
                }).then(response => response.json())
                    .then(data => {
                        elem.setAttribute(DEER.SOURCE, data?.new_obj_state?.["@id"])
                        elem.dataset.transcriptionStatus = (elem.dataset.transcriptionStatus !== "in progress" ? "in progress" : DLA_USER["http://store.rerum.io/agent"])
                        let msg = `❌ Not yet reviewed (click to approve)`
                        if(data?.new_obj_state?.body?.transcriptionStatus !== "in progress"){
                            elem.classList.remove("bg-error")
                            elem.classList.add("bg-success")
                            msg = `✔ Reviewed by <deer-view deer-id="${data?.new_obj_state?.body?.transcriptionStatus}" deer-template="label">${data?.new_obj_state?.body?.transcriptionStatus}</deer-view>`
                            setTimeout(() => UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, document, elem.querySelector(DEER.VIEW)), 0)
                        }
                        elem.innerHTML = msg
                        elem.classList[elem.dataset.transcriptionStatus !== "in progress" ? "add" : "remove"]("success")
                    }).catch(err => { })
            })
        }
    }
}

DEER.TEMPLATES.folioTranscription = function (obj, options = {}) {
    return {
        html: obj.tpenProject ? `<div class="is-full-width"> <h3> ... loading preview ... </h3> </div>` : ``,
        then: (elem) => {
            const proj = obj.tpenProject?.value ?? obj.tpenProject?.pop()?.value ?? obj.tpenProject?.pop() ?? obj.tpenProject
            if (!proj) {
                elem.innerHTML = `[ no project linked yet ]`
                return
            }
            fetch("http://t-pen.org/TPEN/manifest/" + proj)
                .then(response => response.json())
                .then(ms => {
                    const pages = ms.sequences[0].canvases.slice(0, 10).reduce((a, b) => a += `
                    <div class="page">
                        <h3>${b.label}</h3>
                        <div class="pull-right col-6">
                            <img src="${b.images[0].resource['@id']}">
                        </div>
                        <div>
                            ${b.otherContent[0].resources.reduce((aa, bb) => aa +=
                        bb.resource["cnt:chars"].length
                            ? bb.resource["cnt:chars"].slice(-1) == '-'
                                ? bb.resource["cnt:chars"].substring(0, bb.resource["cnt:chars"].length - 1)
                                : bb.resource["cnt:chars"] + ' '
                            : " <line class='empty col-6'></line> ", '')
                        }
                        </div>
                    </div>
                    `, ``)

                    elem.innerHTML = `
                    <style>
                        printed {
                            font-family:serif;
                        }
                        note {
                            font-family:monospace;
                        }
                        unclear {
                            opacity:.4;
                        }
                        line.empty {
                            line-height: 1.6;
                            background-color: #CCC;
                            height: 1em;
                            margin: .4em 0;
                            display:block;
                            border-radius: 4px;
                        }
                    </style>
                    <a href="http://t-pen.org/TPEN/transcription.html?projectID=${parseInt(ms['@id'].split("manifest/")?.[1])}" target="_blank">transcribe on TPEN</a>
                    <h2>${ms.label}</h2>
                    <deer-view class="recordStatus tag is-full-width text-center bg-error" id="transcribedStatus" deer-template="transcriptionStatus" deer-id="${obj["@id"]}"></deer-view>
                    ${pages}
                    `
                    setTimeout(() => UTILS.broadcast(undefined, DEER.EVENTS.NEW_VIEW, document, elem.querySelector(DEER.VIEW)), 0)
                })
                .catch(err => { })
        }
    }
}

DEER.TEMPLATES.osd = function (obj, options = {}) {
    const imgURL = obj.sequences[0].canvases[options.index || 0].images[0].resource['@id']
    return {
        html: ``,
        then: elem => {
            OpenSeadragon({
                id: elem.id,
                tileSources: {
                    type: 'image',
                    url: imgURL,
                    crossOriginPolicy: 'Anonymous',
                    ajaxWithCredentials: false
                }
            })
        }
    }
}

DEER.TEMPLATES.lines = function (obj, options = {}) {
    let c = obj.sequences[0].canvases[options.index || 0]
    return {
        html: `
        <div class="page">
            <h3>${c.label}</h3>
            <div class="row">
            <a class="col tag gloss-location ulm" data-change="upper left margin">🡤 margin</a>
                <a class="col tag gloss-location um" data-change="upper margin">🡡 margin</a>
                <a class="col tag gloss-location urm" data-change="upper right margin">🡥 margin</a>
            </div>
            <div class="row">
                <a class="col tag gloss-location llm" data-change="lower left margin">🡧 margin</a>
                <a class="col tag gloss-location lm" data-change="lower margin">🡣 margin</a>
                <a class="col tag gloss-location lrm" data-change="lower right margin">🡦 margin</a>
            </div>
            <div class="row">
                <a class="col tag gloss-location ti" data-change="top intralinear">⇞ intralinear</a>
                <a class="col tag gloss-location li" data-change="lower intralinear">⇟ intralinear</a>
            </div>
<!--            <div class="pull-right col-6">
                <form deer-type="List">
                    <input type="hidden" deer-key="forCanvas" value="${c["@id"]}">
                    <input type="hidden" id="linesList" deer-input-type="List" deer-array-delimeter=" ">
                    <select deer-type="glossLocation">
                        <option value="upper margin">upper margin</option>
                        <option value="lower margin">lower margin</option>
                        <option value="upper left margin">upper left margin</option>
                        <option value="lower left margin">lower left margin</option>
                        <option value="upper right margin">upper right margin</option>
                        <option value="lower right margin">lower right margin</option>
                        <option value="top intralinear">top intralinear</option>
                        <option value="lower intralinear">lower intralinear</option>
                    </select>
                    <input type="submit">
                </form>
            </div> -->
            <div class="col">
                <script>
                    function batchLine(change) {
                        [...document.getElementsByTagName("line")].forEach(l=>{l.classList[change]("selected");l.classList.remove("just")})
                    }
                </script>
                <a class="tag is-small" data-change="add">Select All</a>
                <a class="tag is-small" data-change="remove">Deselect All</a>
                <a class="tag is-small" data-change="toggle">Invert All</a>
            </div>
                ${c.otherContent[0].resources.reduce((aa, bb, i) => aa += `
                <line title="${bb['@id']}" index="${i}">${bb.resource["cnt:chars"].length ? bb.resource["cnt:chars"] : "[ empty line ]"}</line>
                `, ``)}
        </div>
        `,
        then: elem => {
            const allLines = elem.getElementsByTagName("line")
            for (const l of allLines) { l.addEventListener("click", selectLine) }
            function selectLine(event) {
                const lastClick = document.querySelector("line.just")
                const line = event.target.closest("line")
                const SHIFT = event.shiftKey
                if (lastClick && SHIFT) {
                    // band-select
                    const change = lastClick.classList.contains("selected") // change is constant
                        ? "add"
                        : "remove"
                    const lookNext = parseInt(lastClick.getAttribute("index")) < parseInt(line.getAttribute("index"))
                        ? "nextElementSibling"
                        : "previousElementSibling"
                    let changeLine = lastClick
                    do {
                        changeLine = changeLine[lookNext]
                        if (!changeLine.classList.contains("located")) {
                            changeLine.classList[change]("selected")
                        }
                    } while (changeLine !== line)
                } else {
                    if (!line.classList.contains("located")) {
                        line.classList.toggle("selected")
                    }
                }
                if (lastClick) { lastClick.classList.remove("just") }
                if (!line.classList.contains("located")) {
                    line.classList.add("just")
                }
            }
            const controls = elem.querySelectorAll("a.tag")
            for (const b of controls) {
                b.addEventListener("click", e => {
                    const change = e.target.getAttribute("data-change")
                    Array.from(allLines).filter(el => !el.classList.contains("located")).forEach(l => { l.classList[change]("selected"); l.classList.remove("just") })
                })
            }
            const locations = elem.querySelectorAll("a.gloss-location")
            for (const l of locations) {
                l.addEventListener("click", e => {
                    const assignment = e.target.getAttribute("data-change")
                    const selected = elem.querySelectorAll(".selected")
                    for (const s of selected) {
                        s.classList.add("located", assignment.split(/\s/).reduce((response, word) => response += word.slice(0, 1), ''))
                        s.classList.remove("just", "selected")
                    }
                })
            }
        }
    }
}

/**
 * The TEMPLATED renderer to draw an JSON to the screen as some HTML template
 * @param {Object} obj some json of type Entity to be drawn
 * @param {Object} options additional properties to draw with the Entity
 */
DEER.TEMPLATES.entity = function (obj, options = {}) {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    let list = ``

    for (let key in obj) {
        if (DEER.SUPPRESS.indexOf(key) > -1) { continue }
        let label = key
        let value = UTILS.getValue(obj[key], key)
        try {
            if ((value.image || value.trim()).length > 0) {
                list += (label === "depiction") ? `<img title="${label}" src="${value.image || value}" ${DEER.SOURCE}="${UTILS.getValue(obj[key].source, "citationSource")}">` : `<dt deer-source="${UTILS.getValue(obj[key].source, "citationSource")}">${label}</dt><dd>${value.image || value}</dd>`
            }
        } catch (err) {
            // Some object maybe or untrimmable somesuch
            // is it object/array?
            list += `<dt>${label}</dt>`
            if (Array.isArray(value)) {
                value.forEach((v, index) => {
                    let name = UTILS.getLabel(v, (v.type || v['@type'] || label + '' + index))
                    list += (v["@id"]) ? `<dd><a href="#${v["@id"]}">${name}</a></dd>` : `<dd ${DEER.SOURCE}="${UTILS.getValue(v.source, "citationSource")}">${UTILS.getValue(v)}</dd>`
                })
            } else {
                // a single, probably
                // TODO: export buildValueObject() from UTILS for use here
                if (typeof value === "string") {
                    value = {
                        value: value,
                        source: {
                            citationSource: obj['@id'] || obj.id || "",
                            citationNote: "Primitive object from DEER",
                            comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/deer"
                        }
                    }
                }
                let v = UTILS.getValue(value)
                if (typeof v === "object") { v = UTILS.getLabel(v) }
                if (v === "[ unlabeled ]") { v = v['@id'] || v.id || "[ complex value unknown ]" }
                list += (value['@id']) ? `<dd ${DEER.SOURCE}="${UTILS.getValue(value.source, "citationSource")}"><a href="${options.link || ""}#${value['@id']}">${v}</a></dd>` : `<dd ${DEER.SOURCE}="${UTILS.getValue(value, "citationSource")}">${v}</dd>`
            }
        }
    }
    tmpl += (list.includes("</dd>")) ? `<dl>${list}</dl>` : ``
    return tmpl
}

DEER.TEMPLATES.list = function (obj, options = {}) {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    if (options.list) {
        tmpl += `<ul>`
        obj[options.list].forEach((val, index) => {
            let name = UTILS.getLabel(val, (val.type || val['@type'] || index))
            tmpl += (val["@id"] && options.link) ? `<li ${DEER.ID}="${val["@id"]}"><a href="${options.link}${val["@id"]}">${name}</a></li>` : `<li ${DEER.ID}="${val["@id"]}">${name}</li>`
        })
        tmpl += `</ul>`
    }
    return tmpl
}

/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json of type Person to be drawn
 * @param {Object} options additional properties to draw with the Person
 */
DEER.TEMPLATES.person = function (obj, options = {}) {
    try {
        let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
        let dob = DEER.TEMPLATES.prop(obj, { key: "birthDate", label: "Birth Date" }) || ``
        let dod = DEER.TEMPLATES.prop(obj, { key: "deathDate", label: "Death Date" }) || ``
        let famName = (obj.familyName && UTILS.getValue(obj.familyName)) || "[ unknown ]"
        let givenName = (obj.givenName && UTILS.getValue(obj.givenName)) || ""
        tmpl += (obj.familyName || obj.givenName) ? `<div>Name: ${famName}, ${givenName}</div>` : ``
        tmpl += dob + dod
        tmpl += `<a href="#${obj["@id"]}">${name}</a>`
        return tmpl
    } catch (err) {
        return null
    }
    return null
}

/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json of type Event to be drawn
 * @param {Object} options additional properties to draw with the Event
 */
DEER.TEMPLATES.event = function (obj, options = {}) {
    try {
        let tmpl = `<h1>${UTILS.getLabel(obj)}</h1>`
        return tmpl
    } catch (err) {
        return null
    }
    return null
}

export default class DeerRender {
    constructor(elem, deer = {}) {
        for (let key in DEER) {
            if (typeof DEER[key] === "string") {
                DEER[key] = deer[key] || config[key]
            } else {
                DEER[key] = Object.assign(config[key], deer[key])
            }
        }
        changeLoader.observe(elem, {
            attributes: true
        })
        this.$dirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.collection = elem.getAttribute(DEER.COLLECTION)
        this.elem = elem

        try {
            if (!(this.id || this.collection)) {
                let err = new Error(this.id + " is not a valid id.")
                err.code = "NO_ID"
                throw err
            } else {
                if (this.id) {
                    fetch(this.id).then(response => response.json()).then(obj => RENDER.element(this.elem, obj)).catch(err => err)
                } else if (this.collection) {
                    // Look not only for direct objects, but also collection annotations
                    // Only the most recent, do not consider history parent or children history nodes
                    let historyWildcard = { "$exists": true, "$size": 0 }
                    let queryObj = {
                        $or: [{
                            "targetCollection": this.collection
                        }, {
                            "body.targetCollection": this.collection
                        }, {
                            "body.targetCollection.value": this.collection
                        }, {
                            "body.partOf": this.collection
                        }],
                        "__rerum.history.next": historyWildcard
                    }

                    const listObj = {
                        name: this.collection,
                        itemListElement: []
                    }

                    getPagedQuery.bind(this)(100)
                        .then(() => RENDER.element(this.elem, listObj))
                        .catch(err => {
                            console.error("Broke with listObj at ", listObj)
                            RENDER.element(this.elem, listObj)
                        })

                    function getPagedQuery(lim, it = 0) {
                        return fetch(`${DEER.URLS.QUERY}?limit=${lim}&skip=${it}`, {
                            method: "POST",
                            mode: "cors",
                            body: JSON.stringify(queryObj)
                        }).then(response => response.json())
                            // .then(pointers => {
                            //     let list = []
                            //     pointers.map(tc => list.push(fetch(tc.target || tc["@id"] || tc.id).then(response => response.json().catch(err => { __deleted: console.log(err) }))))
                            //     return Promise.all(list).then(l => l.filter(i => !i.hasOwnProperty("__deleted")))
                            // })
                            .then(list => {
                                listObj.itemListElement = listObj.itemListElement.concat(list.map(anno => ({ '@id': anno.target ?? anno["@id"] ?? anno.id })))
                                this.elem.setAttribute(DEER.LIST, "itemListElement")
                                try {
                                    listObj["@type"] = list[0]["@type"] || list[0].type || "ItemList"
                                } catch (err) { }
                                // RENDER.element(this.elem, listObj)
                                if (list.length ?? (list.length % lim === 0)) {
                                    return getPagedQuery.bind(this)(lim, it + list.length)
                                }
                            })
                    }
                }
            }
        } catch (err) {
            let message = err
            switch (err.code) {
                case "NO_ID":
                    message = `` // No DEER.ID, so leave it blank
            }
            elem.innerHTML = message
        }

        let listensTo = elem.getAttribute(DEER.LISTENING)
        if (listensTo) {
            elem.addEventListener(DEER.EVENTS.CLICKED, e => {
                try {
                    if (e.detail.target.closest(DEER.VIEW + "," + DEER.FORM).getAttribute("id") === listensTo) elem.setAttribute(DEER.ID, e.detail.target.closest('[' + DEER.ID + ']').getAttribute(DEER.ID))
                } catch (err) { }
            })
            try {
                window[listensTo].addEventListener("click", e => UTILS.broadcast(e, DEER.EVENTS.CLICKED, elem))
            } catch (err) {
                console.error("There is no HTML element with id " + listensTo + " to attach an event to")
            }
        }

    }
}

/**
 * Go over each listed <deer-view> marked HTMLElement and process the UI requirements to draw and render to the DOM.
 * These views will not contain annotation information.  
 * 
 * Note that the resolution of this promise enforses a 200ms delay.  That is for the deerInitializer.js.  It allows
 * initializeDeerViews to be treated as an asyncronous event before initializeDeerForms interacts with the DOM from
 * resulting rendered <deer-view> marked HTMLElements.  We plan to streamline this process in the near future.  
 * @param {type} config A DEER configuration from deer-config.js
 * @return {Promise} A promise confirming all views were visited and rendered.
 */
export function initializeDeerViews(config) {
    return new Promise((res) => {
        const views = document.querySelectorAll(config.VIEW)
        Array.from(views).forEach(elem => new DeerRender(elem, config))
        document.addEventListener(DEER.EVENTS.NEW_VIEW, e => Array.from(e.detail.set ?? [e.detail]).forEach(elem => new DeerRender(elem, config)))
        /**
         * Really each render should be a promise and we should return a Promise.all() here of some kind.
         * That would only work if DeerRender resulted in a Promise where we could return Promise.all(renderPromises).
         */
        setTimeout(res, 200) //A small hack to ensure all the HTML generated by processing the views enters the DOM before this says it has resolved.
        //Failed 5 times at 100
        //Failed 0 times at 200
    })
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