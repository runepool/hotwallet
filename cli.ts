import { Command } from 'commander';
import axios from 'axios';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

const program = new Command();

const BASE_URL = 'http://localhost:3000'; // Update with your API's base URL

// Command to get wallet balance
program
    .command('get-balance')
    .description('Fetch the wallet balance')
    .action(async () => {
        try {
            const response = await axios.get(`${BASE_URL}/account/balance`);
            console.log('Wallet Balance:', response.data);
        } catch (error) {
            console.error('Error fetching balance:', error.response?.data || error.message);
        }
    });

// Command to create a new order
program
    .command('create-order')
    .description('Create a new order')
    .requiredOption('-r, --rune <rune>', 'The rune being traded')
    .requiredOption('-q, --quantity <quantity>', 'The quantity of the rune')
    .requiredOption('-p, --price <price>', 'The price per unit of the rune')
    .requiredOption('-t, --type <type>', 'The order type (ask/bid)')
    .action(async (options) => {
        try {
            const response = await axios.post(`${BASE_URL}/orders`, {
                rune: options.rune,
                quantity: options.quantity,
                price: options.price,
                type: options.type,
            });
            console.log('Order Created:', response.data);
        } catch (error) {
            console.error('Error creating order:', error.response?.data || error.message);
        }
    });

// Command to create batch orders
program
    .command('create-batch')
    .description('Create multiple orders')
    .requiredOption('-o, --orders <orders...>', 'The orders as JSON strings')
    .action(async (options) => {
        try {
            const parsedOrders = options.orders.map((order: string) => JSON.parse(order));
            const response = await axios.post(`${BASE_URL}/orders/batch`, {
                orders: parsedOrders,
            });
            console.log('Batch Orders Created:', response.data);
        } catch (error) {
            console.error('Error creating batch orders:', error.response?.data || error.message);
        }
    });

// Command to list all orders
program
    .command('list-orders')
    .description('List all orders')
    .action(async () => {
        try {
            const response = await axios.get(`${BASE_URL}/orders`);
            console.log('Orders:', response.data);
        } catch (error) {
            console.error('Error fetching orders:', error.response?.data || error.message);
        }
    });

// Command to get order by ID
program
    .command('get-order')
    .description('Get an order by ID')
    .requiredOption('-i, --id <id>', 'The ID of the order')
    .action(async (options) => {
        try {
            const response = await axios.get(`${BASE_URL}/orders/${options.id}`);
            console.log('Order:', response.data);
        } catch (error) {
            console.error('Error fetching order:', error.response?.data || error.message);
        }
    });



// Add a command to generate a Nostr key pair
program
    .command('generate-nostr-key')
    .description('Generate a Nostr private and public key pair')
    .action(() => {
        const privateKey = generateSecretKey();
        const publicKey = getPublicKey(privateKey);
        console.log('Nostr Private Key:', Buffer.from(privateKey).toString("hex"));
        console.log('Nostr Public Key:', publicKey);
    });

// Parse and execute commands
program.parse(process.argv);

