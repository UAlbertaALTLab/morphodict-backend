# morphodict-backend
This runs the back-end API for the newly refactor Morphodict applications.
It's a Django-REST application.

## Working locally
Clone this repo:
```shell
git clone https://github.com/UAlbertaALTLab/morphodict-backend.git
```

Change directories into this repo
```shell
cd morphodict-backend
```

Make a new pip environment
```shell
pipenv shell
```

Initialize Large File Storage (LFS):
```shell
git lfs install && git lfs fetch && git lfs checkout
```

Install all dependencies
```shell
pipenv install --dev
```

If dependencies are still missing, try:
```shell
pipenv install
```

You shouldn't need any npm dependencies, but in case you do:
```shell
npm install
```

And then run all backends with:
```shell
foreman start
```

### Files you'll need
You'll need a number of files that should be stored in LFS, including HFST lookup
files. You'll also need a dictionary, ask whoever is setting you up to 
get you started with one. Please inform Jolene <jcpoulin@ualberta.ca> if 
there are any other dependencies that you need but aren't available through 
LFS or by asking the person helping you.


## Usage
There are three public API endpoints you can use with a total of five options for searching.

### search
This option features the word `search` in the URL and has 3 optional arguments you can pass to it.

#### name
Accessed by typing the following: 
`api.itwewina.altlab.dev/api/search/?name=<search_term>` where <search_term> 
is a word in Plains Cree or in English.

Returns a JSON object.

#### rw_index
Accessed by typing the following: `api.itwewina.altlab.dev/api/search/?rw_index=<index>`
 where <index> is a string of numbers, such as `1.2.2` or `1.6`. Returns 
all objects with a RapidWords index that equals or contains the index provided 
as a JSON object.

#### rw_domain
Accessed by typing the following: 
`api.itwewina.altlab.dev/api/search/?rw_domain=<domain>` where domain is a string. 
Returns all objects where the RapidWords class is or contains the domain provided. 
Return type is JSON.

#### wn_synset
Accessed by typing the following: 
`api.itwewina.altlab.dev/api/search/?wn_synset=<synset>` where <synset> is a string. 
Returns all objects where the WordNet synsets contains or matches the string provided. 
Return type is JSON.
**Note:** There **must** be a space between the last word of the synset and 
the number of the synset. For example: `(n) dog 1` (with spaces, just like that) 
is correct. Incorrect variants include: `(n) dog1` and `(n) dog#1`.

### rapidwords
In this option, you route to the `rapidwords` endpoint. It has one required argument.

#### q
`q`, short for "query" is added to the end of the URL. It can be used in two ways:

1. `http://api.itwewina.dev/api/rapidwords/?q=1.2.2` with a series of numbers separated 
by a period. This will query for a RapidWords entry with the matching index.
2. `http://api.itwewina.dev/api/rapidwords/?q=Names%20of%20animals` with a string exactly matching 
   (case sensitive) the domain of a RapidWords domain.
   
This endpoint returns a JSON object with the fields:
* query
* class
* domain
* index
* hypernyms
* hyponyms

### wordnet
The React-accessible endpoint for the nltk WordNet corpus. Accessed at: 
`api.itwewina.dev/api/wordnet/<wn_class>` where `wn_class` is a string following 
this exact format: **(pos) word number**. For example: (n) dog 1. It returns for (n) dog 1:
```json
{
    "search_term": "dog.n.01",
    "hypernyms": [
        "canine.n.02",
        "domestic_animal.n.01"
    ],
    "hyponyms": [
        "basenji.n.01",
        "corgi.n.01",
        "cur.n.01",
        "dalmatian.n.02",
        "great_pyrenees.n.01",
        "griffon.n.02",
        "hunting_dog.n.01",
        "lapdog.n.01",
        "leonberg.n.01",
        "mexican_hairless.n.01",
        "newfoundland.n.01",
        "pooch.n.01",
        "poodle.n.01",
        "pug.n.01",
        "puppy.n.01",
        "spitz.n.01",
        "toy_dog.n.01",
        "working_dog.n.01"
    ],
    "holonyms": [
        "canis.n.01",
        "pack.n.06"
    ]
}
```

## Deployment
The backend currently needs to be deployed manually. Eventually, it will be 
stable enough to deploy automatically like the orginal/legacy Morphodict, but 
for now it needs a little more supervision. To deploy, follow these steps:
1. Make, review, and merge any changes needed for the deployment into `main`
2. ssh into the server, itw.altlab.dev
3. Become morphodict: sudo -i -u morphodict. Note: you need permission to do this.
4. `cd morphodict-backend`
5. `cd docker`
6. `docker-compose build`
7. `./deploy`

Ideally, the `./deploy` script will handle all of the deployment steps 
and then you can call that script from the deploy hook, like the legacy 
app does. But for now, this is required.
