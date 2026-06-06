import Api from "../../util/backend.js";

const TEN_MINUTES = 10 * 60 * 1000;

class Product
{
    constructor (data)
    {
        this.name = data.name || 'Unknown';
        this.price = data.price;
        this.duration = data.duration;
        this.duration_text = data["duration_text"];
        this.key = data.key || '';
    }

    get IsFree()
    {
        return this.key === 'free';
    }

    get IsLifetime()
    {
        return this.duration === -1;
    }

    FormatPrice()
    {
        if(this.IsFree) return `${Number(this.price).toFixed(1)} Balance`;
        return `€${this.price.toFixed(2)}`;
    }
    FormatDuration()
    {
        if(this.IsLifetime) return 'LIFETIME';
        return String(this.duration_text).toUpperCase();
    }
}

function getCachedProducts() {
    try {
        const raw = localStorage.getItem('cache_products');
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < TEN_MINUTES) return item.data;
        localStorage.removeItem('cache_products');
    } catch (e) {}
    return null;
}

function setCachedProducts(products) {
    try {
        localStorage.setItem('cache_products', JSON.stringify({ data: products, timestamp: Date.now() }));
    } catch (e) {}
}

const ProductsManager =
{
    async FetchProducts() 
    {
        const cached = getCachedProducts();
        if (cached) return cached.map(p => new Product(p));

        const response = await fetch(`${await Api.GetApiUrl()}/products/getall`);
        const rawProducts = await response.json();

        let products = rawProducts.map(p => new Product(p));
        setCachedProducts(rawProducts);
        return products;
    }
};

export { Product, ProductsManager };