
# groc
groc is a grocery list app. Users scan QR codes on recipe cards to add ingredients to a grocery list, then check off ingredients as they shop.

## React install 

```
npm install
npm start
npm build
```

### user flow
User has a physical box full of recipe cards, where the recipes are written and physically readable. 
Each recipe card also has a QR code. 
Users scan the QR code to add the recipe's ingredients to a grocery list. 
They scan multiple recipes to add multiple sets of ingredients to that same grocery list.
Users only have one grocery list at a time.
When they go to the store, they can check off ingredients as they shop.

### pages
- create user / login
    - the back end uses djangorestframework-simplejwt
- show current recipes in grocery list
- show current ingredients needed in grocery list
    - check boxes for use in store as purchase list
- pages to be used as targets for QR codes on recipe cards
    - each page corresponds to a recipe
    - when user visits page, ingredients for that recipe are added to grocery list
    - then redirect to recipe list page
- a page for testing before we have the physical QR codes: shows cards with recipe names and a QR code for each recipe page. 
