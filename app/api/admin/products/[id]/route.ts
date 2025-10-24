// /api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, getCompanyFilter } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, deleteFile, renameFile } from '@/lib/storage';
import { sanitizeFilename } from '@/lib/files';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/products/[id] - Atualizações parciais (ex.: toggle active)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const productId = params.id;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        ...getCompanyFilter(session),
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ success: false, error: 'Produto não encontrado' }, { status: 404 });
    }

    // Espera JSON (ex.: { active: true })
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const updateData: any = {};

    // Aceita somente campos permitidos - atualiza apenas os presentes no body
    if (Object.prototype.hasOwnProperty.call(body, 'active')) {
      updateData.active = !!body.active;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'stock_quantity')) {
      const sq = Number(body.stock_quantity);
      updateData.stock_quantity = Number.isNaN(sq) ? existingProduct.stock_quantity ?? 0 : sq;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      updateData.name = body.name == null ? existingProduct.name : String(body.name);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      updateData.description = body.description == null ? null : String(body.description);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'category_id')) {
      updateData.category_id = body.category_id == null ? existingProduct.category_id : String(body.category_id);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'sku')) {
      updateData.sku = body.sku == null ? null : String(body.sku);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'base_price')) {
      const bp = parseFloat(String(body.base_price));
      updateData.base_price = Number.isNaN(bp) ? existingProduct.base_price : bp;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'volume')) {
      updateData.volume = body.volume == null ? null : String(body.volume);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'unit_type')) {
      updateData.unit_type = body.unit_type == null ? null : String(body.unit_type);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    const fullProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, variants: true },
    });

    return NextResponse.json({ success: true, data: fullProduct });
  } catch (error) {
    console.error('Products PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Erro ao atualizar produto' }, { status: 500 });
  }
}

// PUT /api/admin/products/[id] - Atualizar produto (form multipart/form-data completo)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const productId = params.id;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        ...getCompanyFilter(session),
      },
      include: { variants: true },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = (formData.get('description') as string) ?? null;
    const category_id = formData.get('category_id') as string;
    const sku = (formData.get('sku') as string) ?? null;
    const base_price = parseFloat(formData.get('base_price') as string);
    const active = formData.get('active') === 'true';
    const imageFile = formData.get('image') as File | null;
    const variantsJson = (formData.get('variants') as string) ?? null;
    const removeImage = formData.get('remove_image') === 'true';

    // Novos campos do produto "pai"
    const volumeRaw = (formData.get('volume') as string) ?? '';
    const unitTypeRaw = (formData.get('unit_type') as string) ?? '';
    const stockQtyRaw = (formData.get('stock_quantity') as string) ?? '';

    const volume = volumeRaw.trim() || null;
    const unit_type = unitTypeRaw.trim() || null;
    const stock_quantity = Number.isNaN(parseInt(stockQtyRaw, 10))
      ? existingProduct.stock_quantity ?? 0
      : parseInt(stockQtyRaw, 10);

    let image_url = existingProduct.image_url;

    // Remover imagem antiga se solicitado
    if (removeImage && image_url) {
      try {
        await deleteFile(image_url);
        image_url = null;
      } catch (e) {
        console.error('Error deleting old image:', e);
      }
    }

    // Upload da nova imagem se fornecida
    if (imageFile) {
      // Deletar imagem antiga se existir
      if (image_url) {
        try {
          await deleteFile(image_url);
        } catch (e) {
          console.error('Error deleting old image:', e);
        }
      }

      const buffer = Buffer.from(await imageFile.arrayBuffer());
      await sharp(buffer).metadata(); // valida imagem

      const ext = path.extname(imageFile.name) || '.jpg';
      const base = path.basename(imageFile.name, ext);
      const safeBase = sanitizeFilename(base) || `${Date.now()}`;

      const tempKey = `products/temp/${Date.now()}_${safeBase}${ext}`;
      await uploadFile(buffer, tempKey);
      image_url = tempKey; // será movido ao final
    }

    // Atualizar produto
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        description,
        category_id,
        sku,
        base_price,
        image_url,
        active,
        // novos campos
        volume,
        unit_type,
        stock_quantity,
      },
    });

    // Mover imagem temporária para pasta final
    if (image_url && image_url.startsWith('products/temp/')) {
      const ext = path.extname(image_url);
      const tempBasename = path.basename(image_url);
      const safeBase = tempBasename.replace(/^[0-9]+_/, '').replace(ext, '') || 'image';
      const finalKey = `products/${product.id}/${safeBase}${ext}`;
      await renameFile(image_url, finalKey);
      await prisma.product.update({
        where: { id: product.id },
        data: { image_url: finalKey },
      });
    }

    // Atualizar variações se fornecidas
    if (variantsJson) {
      const variants = JSON.parse(variantsJson);

      // Deletar variações antigas
      await prisma.productVariant.deleteMany({
        where: { product_id: productId },
      });

      // Criar novas variações
      if (Array.isArray(variants) && variants.length > 0) {
        const variantData = await Promise.all(
          variants.map(async (v: any) => {
            let imageUrl = v.image_url || null;
            if (imageUrl && imageUrl.startsWith('products/temp/')) {
              const ext = path.extname(imageUrl) || '.jpg';
              const tempBasename = path.basename(imageUrl);
              const safeBase = tempBasename.replace(/^[0-9]+_/, '').replace(ext, '') || `${Date.now()}`;
              const finalKey = `products/${product.id}/variants/${Date.now()}_${safeBase}${ext}`;
              await renameFile(imageUrl, finalKey);
              imageUrl = finalKey;
            }
            return {
              product_id: productId,
              name: v.name,
              volume: v.volume || null,
              sku: v.sku || null,
              unit_type: v.unit_type || null,
              price_modifier: v.price_modifier || 0,
              stock_quantity: v.stock_quantity || 0,
              image_url: imageUrl,
              active: v.active !== false,
            };
          })
        );

        await prisma.productVariant.createMany({
          data: variantData,
        });
      }
    }

    // Buscar produto completo com variações
    const fullProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: true,
      },
    });

    return NextResponse.json({ success: true, data: fullProduct });
  } catch (error) {
    console.error('Products PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar produto' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] - Deletar produto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const productId = params.id;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        ...getCompanyFilter(session),
      },
      include: { variants: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    // --- Verificar se existe alguma order_item que referencie este produto ---
    const referencingOrderItem = await prisma.orderItem.findFirst({
      where: {
        product_id: productId,
      },
      select: { id: true }, // só precisamos saber se existe
    });

    if (referencingOrderItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não é possível deletar este produto: existem pedidos que contém este produto.',
        },
        { status: 409 } // Conflict
      );
    }
    // ------------------------------------------------------------------------

    // Deletar imagem principal
    if (product.image_url) {
      try {
        await deleteFile(product.image_url);
      } catch (e) {
        console.error('Error deleting image:', e);
      }
    }

    // Deletar imagens das variações
    for (const variant of product.variants) {
      if (variant.image_url) {
        try {
          await deleteFile(variant.image_url);
        } catch (e) {
          console.error('Error deleting variant image:', e);
        }
      }
    }

    // Deletar produto (variações são deletadas em cascata)
    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Products DELETE error:', error);

    // Tratamento específico para erro de FK (caso ocorra por alguma razão)
    if (
      error &&
      (error as any).code === 'P2003' // fallback caso não usemos instanceof
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não é possível deletar este produto: existem registros dependentes (pedidos) que o utilizam.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro ao deletar produto' },
      { status: 500 }
    );
  }
}