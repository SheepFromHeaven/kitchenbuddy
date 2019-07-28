const puppeteer = require('puppeteer');
const fs = require('fs');
const urls = require('./recipesToFetch.json');

const extractAttributes = ingredientName => ({
  name: ingredientName.split(',')[0].trim(),
  attributes: ingredientName.split(',').slice(1).map(i => i.trim())
})

const extractUnit = ingredientAmount => ({
  amount: ingredientAmount.split('&nbsp;')[0].trim().match(new RegExp(/<sup>.<\/sup>\/<sub>.<\/sub>/, 'g')) ? eval(ingredientAmount.split('&nbsp;')[0].trim().replace(ingredientAmount.split('&nbsp;')[0].trim().match(new RegExp(/<sup>.<\/sup>\/<sub>.<\/sub>/, 'g'))[0], '+' + eval(ingredientAmount.split('&nbsp;')[0].trim().match(new RegExp(/<sup>.<\/sup>\/<sub>.<\/sub>/, 'g'))[0].replace(/<sup>|<\/sup>|<sub>|<\/sub>/g, '').replace(/[^-()\d/*+.]/g, '')))): parseFloat(ingredientAmount.split('&nbsp;')[0].trim().replace(',', '.')),
  unit: ingredientAmount.split('&nbsp;')[1].trim()
})

const getRecipeFromChefkochUrl = async (url) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', (req) => {
    if (req.resourceType() !== 'document') {
      req.abort();
    }
    else {
      req.continue();
    }
  });
  await page.goto(`${url}?portionen=1`).catch(async (e) => {console.log(e); await browser.close();});

  const ingredients = await page.evaluate(() => {
    return [...document.querySelectorAll('.incredients tr')]
      .map(element => ({
        name: element.querySelectorAll('td')[1].children[0] && element.querySelectorAll('td')[1].children[0].tagName == 'A' ? element.querySelectorAll('td')[1].querySelector('a').innerHTML.trim() : element.querySelectorAll('td')[1].innerHTML.trim(),
        amount: element.querySelectorAll('td')[0].innerHTML.trim()
      }));
  });

  const pageTitle = await page.evaluate(() => {
    return document.querySelector('.page-title').innerHTML
  });
  await browser.close();
  return {
    pageTitle,
    ingredients
  }
}


const fetchRecipe = async (url) => {
  
  const {pageTitle, ingredients} = await getRecipeFromChefkochUrl(url);

  return {
    name: pageTitle,
    ingredients: ingredients.map(i => ({
      ...extractAttributes(i.name),
      ...extractUnit(i.amount)
    }))
  }
};

(async () => {
  const recipes = await Promise.all(urls.map(fetchRecipe));
  fs.writeFileSync('recipes.json', JSON.stringify(recipes));
})()