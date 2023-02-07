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
There are two public API endpoints you can use with a total of five options for searching.

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

1. `http://127.0.0.1:8000/api/rapidwords/?q=1.2.2` with a series of numbers separated 
by a period. This will query for a RapidWords entry with the matching index.
2. `http://127.0.0.1:8000/api/rapidwords/?q=Names%20of%20animals` with a string exactly matching 
   (case sensitive) the domain of a RapidWords domain.
   
This endpoint returns a JSON object with the fields:
* query
* class
* domain
* index
* hypernyms
* hyponyms
