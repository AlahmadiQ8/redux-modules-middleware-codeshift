Forked from [reactjs/react-codemod](https://github.com/reactjs/react-codemod)

code shift for redux-modules middleware. 

```
import { createModule, middleware } from "redux-modules";
```

to 

```
import { createModule } from "redux-modules";
import middleware from 'redux-modules-middleware';
```


## Running: 

- first install jscodeshift
  - `yarn global add jscodeshift`
- clone this repo
- go to your repository that you want to apply the codeshift and run the following: 
  - `jscodeshift -t <PATH_TO_CLONED_REPO>/to-redux-modules-middleware.js src/`
