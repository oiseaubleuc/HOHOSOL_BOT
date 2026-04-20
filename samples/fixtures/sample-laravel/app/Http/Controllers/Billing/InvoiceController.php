<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;

class InvoiceController extends Controller
{
    public function show(int $id)
    {
        return view('pdf.invoice', ['id' => $id]);
    }
}
