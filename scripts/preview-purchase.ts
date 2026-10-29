import {purchasePdf} from '../server/purchase-pdf';
import fs from 'node:fs';
const pdf=await purchasePdf({id:'PC-EXEMPLO-1',supplierId:1,status:'ordered',deliveryDays:2,paymentMethod:'Boleto',paymentDays:14,total:'140.00',items:[{id:1,itemName:'Muçarela',quantity:'5',unit:'kg',unitPrice:'20.00',total:'100.00'},{id:2,itemName:'Farinha de trigo',quantity:'2',unit:'kg',unitPrice:'20.00',total:'40.00'}]},'Fornecedor de exemplo — não enviar');
fs.writeFileSync('../pedido-compra-exemplo.pdf',pdf);
