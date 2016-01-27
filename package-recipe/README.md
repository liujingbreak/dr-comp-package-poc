Package recipe
==============

This fold only carries a `package.json` file, in which we put private package dependency list.

It is the place to customize which are the exact packages to be adopted in platform instance.

To automatically fill in this package.json with all packages under `src` folder, simply run below command in root folder:

```
gulp link
```
