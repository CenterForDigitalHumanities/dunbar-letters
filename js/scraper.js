const LOC = 'http://tinypaul.rerum.io/dla/proxy?url=https://udspace.udel.edu/rest/collections/599?expand=items&limit=800'
const cacheLOC = 'media/udel.xml'

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

const DC_MAP = new Map([
    ["dc.contributor.author", { label: "contributor", value: { label: "Dunbar, Paul Laurence", id: "http://viaf.org/viaf/76335432" } }],
    ["dc.date.issued", { label: "issued" }],
    ["dc.identifier.other", { label: "identifier" }],
    ["dc.identifier.uri", { label: "uri" }],
    ["dc.format.extent", { label: "extent" }],
    ["dc.language", { label: "language" }],
    ["dc.publisher", { label: "publisher" }],
    ["dc.rights", { label: "rights" }],
    ["dc.subject", { label: "subject", isArray: true }],
    ["dc.title", { label: "title" }],
    ["dc.identifier.collection", { label: "Collection" }]
])
function fetchLetters(collectionUri) {
    return fetch(collectionUri)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(extractItems)
        .then(drawItems)
        .then(saveItems)
        .catch(() => result.innerHTML = `Oh no, that's all wrong.`)
}

function extractItems(collection) {
    const itemElems = collection.items ?? []
    const itemArray = itemElems.map(i => ({ handle: i.handle, name: i.name }))
    return itemArray
}

function drawItems(itemArray) {
    result.innerHTML = itemArray.reduce((a, b) => a += (`<div is="record" dla-handle="${b.handle}" title="${b.name}"><strong>name:</strong> <name>${b.name}</name> <strong>handle:</strong> <handle>${b.handle}</handle><result></result></div>`), ``)
    document.querySelectorAll("[is='record']").forEach(el => {
        const handle = `http://tinypaul.rerum.io/dla/proxy?url=https://udspace.udel.edu/rest/handle/${el.getAttribute("dla-handle")}`
        fetch(`${handle}?expand=metadata`)
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(res => {
                setMetadata(el, res.metadata)
                el.querySelector("result").innerHTML = "fetched!"
            })
            .catch(err => console.error(err))
    })
    return itemArray
}

function saveItems() {
    return itemArray
}

function setMetadata(el, metadata) {
    el.metadata = {}
    metadata.forEach(data => {
        const values = DC_MAP.get(data.key)
        if (!values) { return }
        const key = values.label
        if (values.isArray) {
            el.metadata[key] = el.metadata[key]?.concat(data.value) ?? [data.value]
            return
        }
        if (values.value) {
            el.metadata[key] = values.value
            return
        }
        el.metadata[key] = data.value
    })
}

fetchLetters(LOC)
