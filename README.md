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
